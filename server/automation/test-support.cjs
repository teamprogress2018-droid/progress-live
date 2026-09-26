'use strict';

const clone = value => value === undefined ? undefined : structuredClone(value);
const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function mergeMaps(previous, next) {
  const merged = isMap(previous) ? clone(previous) : {};
  for (const [key, value] of Object.entries(next)) {
    merged[key] = isMap(value) && Object.keys(value).length
      ? mergeMaps(merged[key], value)
      : clone(value);
  }
  return merged;
}

/** Small transactional Firestore fake: commits serialize and reads cannot follow writes. */
function memoryFirestore(initial = {}) {
  const documents = new Map(Object.entries(initial).map(([path, data]) => [path, clone(data)]));
  const commits = [];
  const faults = [];
  let turn = Promise.resolve();

  function snapshot(path) {
    return {
      exists: documents.has(path),
      id: path.split('/').at(-1),
      ref: doc(path),
      data: () => clone(documents.get(path)),
      get: field => clone(documents.get(path)?.[field]),
    };
  }

  function apply(write) {
    const before = documents.get(write.path);
    documents.set(write.path, write.merge ? mergeMaps(before, write.data) : clone(write.data));
  }

  function doc(path) {
    if (typeof path !== 'string' || !path || path.split('/').length % 2) {
      throw new Error('Invalid document path: ' + path);
    }
    return {
      path,
      id: path.split('/').at(-1),
      get: async () => snapshot(path),
      set: async (data, options = {}) => apply({path, data, merge: !!options.merge}),
      collection: name => collection(path + '/' + name),
    };
  }

  function collection(path, filters = [], cap = Infinity, ordering = null, cursor = null) {
    if (path.split('/').length % 2 !== 1) throw new Error('Invalid collection path: ' + path);
    return {
      path,
      doc: id => doc(path + '/' + id),
      where(field, operation, value) {
        if (operation !== '==') throw new Error('Unsupported query: ' + operation);
        return collection(path, filters.concat([[field, value]]), cap, ordering, cursor);
      },
      limit: limit => collection(path, filters, limit, ordering, cursor),
      orderBy(field) {
        if (field !== '__name__') throw new Error('Unsupported order field: ' + field);
        return collection(path, filters, cap, field, cursor);
      },
      startAt: reference => collection(path, filters, cap, ordering, {path: reference.path, inclusive: true}),
      startAfter: reference => collection(path, filters, cap, ordering, {path: reference.path, inclusive: false}),
      async get() {
        const prefix = path + '/';
        let keys = [...documents.keys()]
          .filter(key => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
          .filter(key => filters.every(([field, value]) => documents.get(key)?.[field] === value));
        if (ordering) keys.sort();
        if (cursor) keys = keys.filter(key => cursor.inclusive ? key >= cursor.path : key > cursor.path);
        const docs = keys
          .slice(0, cap)
          .map(snapshot);
        return {docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn)};
      },
    };
  }

  const db = {
    doc,
    collection,
    async runTransaction(callback) {
      let release;
      const previous = turn;
      turn = new Promise(resolve => { release = resolve; });
      await previous;
      const writes = [];
      try {
        const result = await callback({
          async get(reference) {
            if (writes.length) throw new Error('Firestore requires all transaction reads before writes');
            return snapshot(reference.path);
          },
          set(reference, data, options = {}) {
            writes.push({path: reference.path, data: clone(data), merge: !!options.merge});
            return this;
          },
        });
        const faultIndex = faults.findIndex(fault => fault.match(writes));
        const fault = faultIndex < 0 ? null : faults.splice(faultIndex, 1)[0];
        if (fault?.phase === 'before') throw new Error('Injected unavailable before commit');
        writes.forEach(apply);
        if (writes.length) commits.push(clone(writes));
        if (fault?.phase === 'after') throw new Error('Injected connection loss after commit');
        return result;
      } finally {
        release();
      }
    },
    read: path => clone(documents.get(path)),
    seed(path, data) { documents.set(path, clone(data)); },
    remove: path => documents.delete(path),
    entries: () => [...documents.entries()].map(([path, data]) => [path, clone(data)]),
    commits,
    failNext(phase, match = writes => writes.some(write => /^(tasks|messages)\//.test(write.path))) {
      if (!['before', 'after'].includes(phase)) throw new Error('Unknown failure phase');
      faults.push({phase, match});
    },
  };
  return db;
}

module.exports = {memoryFirestore};
