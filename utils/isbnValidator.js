
/**
 * ✅ Clean ISBN by removing hyphens, spaces, and special characters.
 * @param {string} isbn
 * @returns {string}
 */
export const cleanIsbnForValidation = (isbn) => {
    if (!isbn) return '';
    return isbn.replace(/[^0-9Xx]/g, '').toUpperCase(); // Remove everything except digits and X
  }
  
  /**
   * ✅ Validate ISBN-10 using checksum.
   * @param {string} isbn
   * @returns {boolean}
   */
  function validateISBN10(isbn) {
    if (!/^\d{9}[0-9X]$/.test(isbn)) return false;
  
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += (i + 1) * parseInt(isbn[i]);
    }
    sum += (isbn[9] === 'X' ? 10 : parseInt(isbn[9])) * 10;
  
    return sum % 11 === 0;
  }
  
  /**
   * ✅ Validate ISBN-13 using checksum.
   * @param {string} isbn
   * @returns {boolean}
   */
  function validateISBN13(isbn) {
    if (!/^\d{13}$/.test(isbn)) return false;
  
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
  
    return sum % 10 === 0;
  }
  
  /**
   * 🔍 Main function to validate any ISBN format (10 or 13)
   * @param {string} isbn
   * @returns {boolean}
   */
  export const validateISBN = (isbn) => {
    const cleanIsbn = cleanIsbnForValidation(isbn);
    if (cleanIsbn.length === 10) return validateISBN10(cleanIsbn);
    if (cleanIsbn.length === 13) return validateISBN13(cleanIsbn);
    return false;
  }
  