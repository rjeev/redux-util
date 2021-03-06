/**
 * Js Immutable
 *
 * Copyright © 2015-2016 Rajiv Shakya, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Accepts the selector object and operation intended
 *
 * ### Example (es module)
 * ```js
 * import reduce from 'js-immutable';
 * const deepObject = {
 *  person: {
 *    name: 'John Cena',
 *    address: {
 *      permanent: 'Nepal',
 *      temporary: 'China'
 *    }
 *  }
 * }
 *
 * const selector = {
 *  person: {
 *    address: {
 *      permanent: '#'
 *    }
 *  }
 * }
 *
 * const reducer = reduce(selector)
 * const result = reducer(deepObject)
 *                  .set('Holy land')
 *                  .apply()
 * // => {
 *    person: {
 *      name: ...,
 *      address: {
 *        permanent: 'Holy land',
 *        temporary: 'China'
 *      }
 *    }
 *  }
 * ```
 */

function reduce(selector) {
  if (
    selector === null ||
    !(typeof selector === 'object') ||
    Array.isArray(selector)
  ) {
    throw new Error('Invalid selector');
  }

  if (!Object.keys(selector)
    .length) {
    throw new Error('Invalid selector. No keys to traverse.');
  }
  return function selectorWrapper(_originalObject) {

    function coroutine(coroutineFunction) {
      return function wrapper(...args) {
        // launch the coroutine
        const coro = coroutineFunction(...args);
        // drive it to the first yield
        coro.next();
        return coro;
      }
    }

    function pipe(value, predicate) {
      if (
        value === null ||
        value === undefined ||
        typeof predicate !== 'function'
      ) {
        return value;
      }

      return predicate(value);
    }

    function set(oldValue, newValue) {
      if (newValue === null || newValue === undefined) {
        return oldValue;
      }
      return newValue;
    }

    function extend(oldArray, newArray) {
      if (!Array.isArray(newArray) || !Array.isArray(oldArray)) {
        return oldArray;
      }
      if (newArray.length) {
        return oldArray.concat(newArray);
      }
      return oldArray;
    }

    function append(oldList, value) {
      // if value is null or undefined return the same original list
      if (
        value === undefined ||
        value === null ||
        !Array.isArray(oldList)
      ) {
        return oldList;
      }
      return oldList.concat(value);
    }

    function merge(oldObject, newObject) {
      if (
        newObject === null ||
        newObject === undefined ||
        typeof newObject !== 'object'
      ) {
        return oldObject;
      }
      if (typeof newObject === 'object' && !Object.keys(newObject)
        .length) {
        return oldObject;
      }
      return Object.assign({}, oldObject, newObject);
    }

    // delete being the builtin operator
    function deleteOp(oldObject, key) {
      if (
        key === null ||
        key === undefined
      ) {
        return oldObject;
      }
      if (Array.isArray(oldObject)) {
        return oldObject.filter((val, index) => key !== index);
      }
      if (typeof oldObject === 'object' && oldObject !== null) {
        return Object.keys(oldObject)
          .reduce((acc, k) => (k === key) ? {...acc } : {...acc, [k]: oldObject[k] }, {});
      }
      return oldObject;
    }

    const operationalMapper = {
      set,
      append,
      merge,
      extend,
      delete: deleteOp,
      pipe,
    };

    let toUpdate = {};
    let targetPointer = '#';

    function* toUpdateCoro() {
      while (true) {

        const { updatePayload, pointer } = yield;

        if (pointer === '#') {
          toUpdate = {
            ...toUpdate,
            default: updatePayload
          }
        } else if (
          pointer.startsWith('#') &&
          pointer.length > 1
        ) {
          toUpdate = {
            ...toUpdate,
            [pointer]: updatePayload
          }
        }
      }
    }

    // drive the coroutine to the first yield
    const updateCoroutine = coroutine(toUpdateCoro)();

    return new(class {
      constructor() {
        this.set = this.operationFactory('set');
        this.merge = this.operationFactory('merge');
        this.delete = this.operationFactory('delete');
        this.append = this.operationFactory('append');
        this.extend = this.operationFactory('extend');
        this.pipe = this.operationFactory('pipe');
      }

      of(target) {
        if (!target) {
          return this;
        }
        if (
          typeof target === 'string' &&
          target.startsWith('#') &&
          target.length > 1
        ) {
          targetPointer = target;
        }
        return this;
      }
      operationFactory(operationName) {
        return function wrapper(value) {
          if (value !== undefined || value !== null) {
            updateCoroutine.next({
              updatePayload: {
                value,
                operation: operationName,
              },
              pointer: targetPointer,
            })
          }
          return this;
        }.bind(this);
      }

      selectTransform(originalObject, selectorObject) {
        if (
          typeof selectorObject === 'string' &&
          selectorObject.startsWith('#')
        ) {
          // we reached to the target
          const updateKeys = Object.keys(toUpdate);

          if (!updateKeys.length) {
            throw new Error('Should at least has a one operation intended before applying changes');
          }

          if (selectorObject === '#') {
            if (updateKeys.indexOf('default') !== -1) {
              const updater = toUpdate.default;
              return operationalMapper[updater.operation](originalObject, updater.value);
            }
            return originalObject;
          } else if (updateKeys.indexOf(selectorObject) !== -1) {
            const updater = toUpdate[selectorObject];
            return operationalMapper[updater.operation](originalObject, updater.value);
          }
          return originalObject;
        }

        let clonedObject = Object.assign({}, originalObject);

        for (const key of Object.keys(selectorObject)) {
          const keyedObject = clonedObject[key];
          if (keyedObject === undefined || keyedObject === null) {
            // return back the original state and the copied
            clonedObject = originalObject;
            break;
          }
          const filteredObject = selectorObject[key];
          clonedObject[key] = this.selectTransform(keyedObject, filteredObject);
        }
        return clonedObject;
      }

      apply() {
        return this.selectTransform(_originalObject, selector);
      }

    })();
  };
}

export default reduce;