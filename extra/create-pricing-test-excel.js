/**
 * Script to create a test Excel file with same books but different pricing sources
 */

import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

// Test data with same books but different pricing sources
const pricingTestData = [
    // Header row
    ['ISBN', 'Title', 'Author', 'Price', 'Currency', 'Publisher', 'Year', 'Discount', 'Classification', 'Binding Type', 'Source'],
    
    // Same books as existing but with different pricing sources
    ['978-1234567890', 'Introduction to Programming', 'John Doe', '39.99', 'USD', 'Tech Books Inc', '2023', '15', 'Computer Science', 'Paperback', 'Amazon'],
    ['978-0987654321', 'Advanced JavaScript', 'Jane Smith', '49.99', 'USD', 'Web Publishers', '2023', '10', 'Programming', 'Hardcover', 'Barnes & Noble'],
    ['978-1122334455', 'Data Structures and Algorithms', 'Bob Johnson', '59.99', 'USD', 'Academic Press', '2023', '20', 'Computer Science', 'Paperback', 'Book Depository'],
    
    // Some completely new books
    ['978-2222000001', 'New Book 1: Cloud Computing', 'New Author One', '69.99', 'USD', 'Cloud Publishers', '2024', '5', 'Cloud Computing', 'Hardcover', 'Direct'],
    ['978-2222000002', 'New Book 2: AI Fundamentals', 'New Author Two', '79.99', 'USD', 'AI Publishers', '2024', '10', 'Artificial Intelligence', 'Paperback', 'Direct'],
    
    // Same book, same source (should be duplicate)
    ['978-1234567890', 'Introduction to Programming', 'John Doe', '49.99', 'USD', 'Tech Books Inc', '2023', '10', 'Computer Science', 'Paperback', 'Tech Books Inc']
];

function createPricingTestExcel() {
    try {
        // Create workbook and worksheet
        const ws = xlsx.utils.aoa_to_sheet(pricingTestData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Books');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `pricing-test-books-${timestamp}.xlsx`;
        const filepath = path.join(process.cwd(), 'public', filename);
        
        // Ensure public directory exists
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        // Write file to public directory
        xlsx.writeFile(wb, filepath);
        
        console.log('✅ Pricing test Excel file created successfully!');
        console.log('📄 File:', filepath);
        console.log('📊 Records:', pricingTestData.length - 1); // Exclude header
        console.log('📋 Columns:', pricingTestData[0].length);
        console.log('\n📝 Test data includes:');
        console.log('   - 3 existing books with NEW pricing sources (should add pricing)');
        console.log('   - 2 completely new books (should insert completely)');
        console.log('   - 1 duplicate book with same source (should skip)');
        console.log(`🔗 Access via: http://localhost:8000/public/${filename}`);
        
        return { filepath, filename, url: `http://localhost:8000/public/${filename}` };
        
    } catch (error) {
        console.error('❌ Error creating pricing test Excel file:', error.message);
        return null;
    }
}

// Create the test file if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createPricingTestExcel();
}

export { createPricingTestExcel, pricingTestData };
