/**
 * @param {number} ms time in milliseconds
 * @return {Promise<boolean>} Promise(boolean)
 */
const sleep = (ms: number): Promise<boolean> =>
  new Promise((resolve, _reject) => {
    const timeout = setTimeout(() => {
      resolve(true);
      clearTimeout(timeout);
    }, ms);
  });

export default sleep;
