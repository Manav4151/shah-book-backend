/**
 * Script to create a fresh test Excel file with completely new data
 */

import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

// Fresh test data with completely new ISBNs and titles
const freshTestData = [
    // Header row
    ['ISBN', 'Title', 'Author', 'Price', 'Currency', 'Publisher', 'Year', 'Discount', 'Classification', 'Binding Type'],
    
    // Completely new records that shouldn't exist in database
    ['978-1111000001', 'Fresh Book 1: Modern Web Development', 'Fresh Author One', '45.99', 'USD', 'Fresh Publishers', '2024', '10', 'Web Development', 'Paperback'],
    ['978-1111000002', 'Fresh Book 2: Advanced React Patterns', 'Fresh Author Two', '55.99', 'USD', 'Fresh Publishers', '2024', '5', 'React', 'Hardcover'],
    ['978-1111000003', 'Fresh Book 3: Node.js Mastery', 'Fresh Author Three', '65.99', 'USD', 'Fresh Publishers', '2024', '15', 'Backend Development', 'Paperback'],
    ['978-1111000004', 'Fresh Book 4: TypeScript Deep Dive', 'Fresh Author Four', '75.99', 'USD', 'Fresh Publishers', '2024', '0', 'TypeScript', 'Hardcover'],
    ['978-1111000005', 'Fresh Book 5: DevOps Fundamentals', 'Fresh Author Five', '85.99', 'USD', 'Fresh Publishers', '2024', '20', 'DevOps', 'Paperback'],
    
    // Add some duplicates from existing data to test duplicate detection
    ['978-1234567890', 'Introduction to Programming', 'John Doe', '49.99', 'USD', 'Tech Books Inc', '2023', '10', 'Computer Science', 'Paperback'],
    ['978-0987654321', 'Advanced JavaScript', 'Jane Smith', '59.99', 'USD', 'Web Publishers', '2023', '5', 'Programming', 'Hardcover']
];

function createFreshTestExcel() {
    try {
        // Create workbook and worksheet
        const ws = xlsx.utils.aoa_to_sheet(freshTestData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Books');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `fresh-test-books-${timestamp}.xlsx`;
        const filepath = path.join(process.cwd(), 'public', filename);
        
        // Ensure public directory exists
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        // Write file to public directory
        xlsx.writeFile(wb, filepath);
        
        console.log('✅ Fresh test Excel file created successfully!');
        console.log('📄 File:', filepath);
        console.log('📊 Records:', freshTestData.length - 1); // Exclude header
        console.log('📋 Columns:', freshTestData[0].length);
        console.log('\n📝 Test data includes:');
        console.log('   - 5 completely new books (should be inserted)');
        console.log('   - 2 duplicate books (should be skipped)');
        console.log(`🔗 Access via: http://localhost:8000/public/${filename}`);
        
        return { filepath, filename, url: `http://localhost:8000/public/${filename}` };
        
    } catch (error) {
        console.error('❌ Error creating fresh test Excel file:', error.message);
        return null;
    }
}

// Create the test file if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createFreshTestExcel();
}

export { createFreshTestExcel, freshTestData };
