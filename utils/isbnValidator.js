/**
 * Cleans the raw ISBN string for validation.
 * @param {string} raw The raw ISBN string.
 * @returns {string} A cleaned string ready for validation.
 */
export const cleanIsbnForValidation = (raw) => {
    if (!raw) return '';
    const upper = String(raw).toUpperCase();
    // Keep only digits and 'X'
    const alnum = upper.replace(/[^0-9X]/g, '');

    // If length > 10, it's potentially ISBN-13 → must be digits only
    if (alnum.length > 10) {
        return alnum.replace(/[^0-9]/g, '');
    }

    // For length <= 10, if 'X' appears anywhere but the last position, remove it.
    if (alnum.includes('X') && alnum.indexOf('X') !== alnum.length - 1) {
        return alnum.replace(/X/g, '');
    }
    return alnum;
};

/**
 * Validates a 10-digit ISBN using the checksum algorithm.
 * @param {string} cleanISBN A 10-character string.
 * @returns {boolean}
 */
const validateISBN10 = (cleanISBN) => {
    if (cleanISBN.length !== 10 || !/^\d{9}[\dX]$/.test(cleanISBN)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanISBN[i]) * (10 - i);
    }
    const checkDigit = cleanISBN[9] === 'X' ? 10 : parseInt(cleanISBN[9]);
    sum += checkDigit;
    return sum % 11 === 0;
};

/**
 * Validates a 13-digit ISBN using the checksum algorithm.
 * @param {string} cleanISBN A 13-character string.
 * @returns {boolean}
 */
const validateISBN13 = (cleanISBN) => {
    if (cleanISBN.length !== 13 || !/^\d{13}$/.test(cleanISBN)) return false;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleanISBN[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(cleanISBN[12]);
};

/**
 * The main validation function. Cleans the input and checks for ISBN-10 or ISBN-13 validity.
 * @param {string} isbn The raw ISBN string to validate.
 * @returns {boolean} True if the ISBN is valid, otherwise false.
 */
export const validateISBN = (isbn) => {
    if (!isbn || String(isbn).trim() === '') return false; // An empty ISBN is not valid for this check.

    const cleanISBN = cleanIsbnForValidation(isbn);

    if (cleanISBN.length === 10) {
        return validateISBN10(cleanISBN);
    } else if (cleanISBN.length === 13) {
        return validateISBN13(cleanISBN);
    }

    return false;
};

