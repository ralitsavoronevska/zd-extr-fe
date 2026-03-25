/**
 * Creates a debounced version of the given function.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (fn, delay) => {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, delay);
    };
};
