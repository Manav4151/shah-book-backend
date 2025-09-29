/**
 * Simple test script for Excel import functionality
 * Tests with a smaller dataset to avoid MongoDB timeout issues
 */

import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { validateExcelMapping, bulkImportExcel } from '../utils/bulkImport.js';

// Simple test data with key scenarios
const simpleTestData = [
    // Header row
    ['ISBN', 'Title', 'Author', 'Price', 'Currency', 'Publisher', 'Year', 'Discount', 'Classification', 'Binding Type'],
    
    // Normal records
    ['978-1111111111', 'Test Book 1', 'Test Author 1', '29.99', 'USD', 'Test Publisher', '2023', '10', 'Fiction', 'Paperback'],
    ['978-2222222222', 'Test Book 2', 'Test Author 2', '39.99', 'USD', 'Test Publisher', '2023', '5', 'Non-Fiction', 'Hardcover'],
    
    // Duplicate record (same ISBN + Title + Author)
    ['978-1111111111', 'Test Book 1', 'Test Author 1', '29.99', 'USD', 'Test Publisher', '2023', '10', 'Fiction', 'Paperback'],
    
    // Conflict record (same ISBN, different title)
    ['978-1111111111', 'Test Book 1 - CONFLICT', 'Test Author 1', '35.99', 'USD', 'Test Publisher', '2024', '15', 'Fiction', 'Hardcover'],
    
    // Missing required fields (should cause errors)
    ['978-3333333333', '', 'Test Author 3', '25.99', 'USD', 'Test Publisher', '2023', '0', 'Error', 'Paperback'],
    ['978-4444444444', 'Test Book 4', '', '25.99', 'USD', 'Test Publisher', '2023', '0', 'Error', 'Paperback'],
    
    // Empty row (should be skipped)
    ['', '', '', '', '', '', '', '', '', ''],
    
    // Valid record after empty row
    ['978-5555555555', 'Test Book 5', 'Test Author 5', '15.99', 'USD', 'Test Publisher', '2023', '0', 'Valid', 'Paperback']
];

function createSimpleTestFile() {
    try {
        // Create workbook and worksheet
        const ws = xlsx.utils.aoa_to_sheet(simpleTestData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Simple Test');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `simple-test-${timestamp}.xlsx`;
        const filepath = path.join(process.cwd(), filename);
        
        // Write file
        xlsx.writeFile(wb, filepath);
        
        console.log('✅ Simple test Excel file created successfully!');
        console.log('📄 File:', filepath);
        console.log('📊 Records:', simpleTestData.length - 1); // Exclude header
        console.log('📋 Columns:', simpleTestData[0].length);
        console.log('\n🧪 Test scenarios included:');
        console.log('   ✅ Normal records (2)');
        console.log('   🔄 Exact duplicate (1)');
        console.log('   ⚠️  ISBN conflict (1)');
        console.log('   ❌ Missing required fields (2)');
        console.log('   📝 Empty row (1)');
        console.log('   ✅ Valid record (1)');
        
        return { filepath, filename };
        
    } catch (error) {
        console.error('❌ Error creating simple test file:', error.message);
        return null;
    }
}

async function runSimpleTest() {
    console.log('🧪 Starting Simple Excel Import Test');
    console.log('===================================');
    
    // Create test file
    const testFile = createSimpleTestFile();
    if (!testFile) {
        console.error('❌ Failed to create test file');
        return;
    }
    
    const { filepath, filename } = testFile;
    const originalName = path.basename(filename, path.extname(filename));
    
    try {
        // Step 1: Test validation
        console.log('\n🔍 Step 1: Testing Validation API...');
        const validationResult = await validateExcelMapping(filepath);
        
        if (validationResult.success) {
            console.log('✅ Validation successful!');
            console.log('📊 Headers found:', validationResult.headers.length);
            console.log('🗺️  Auto-mapped fields:', Object.keys(validationResult.mapping).length);
            console.log('📈 Total rows:', validationResult.validation.totalRows);
            console.log('✅ Required book fields:', validationResult.validation.hasRequiredBookFields);
            console.log('✅ Required pricing fields:', validationResult.validation.hasRequiredPricingFields);
        } else {
            console.log('❌ Validation failed:', validationResult.message);
            return;
        }
        
        // Step 2: Test import
        console.log('\n🚀 Step 2: Testing Bulk Import API...');
        
        const importResult = await bulkImportExcel(filepath, validationResult.mapping, originalName, {
            skipDuplicates: true,
            skipConflicts: true,
            updateExisting: false
        });
        
        if (importResult.success) {
            console.log('✅ Import completed!');
            console.log('📊 Stats:', importResult.stats);
            console.log('📄 Log file:', importResult.logFile);
            
            // Step 3: Analyze results
            console.log('\n📊 Step 3: Analysis Summary');
            console.log('==========================');
            console.log(`   📥 Total processed: ${importResult.stats.total}`);
            console.log(`   ✅ Inserted: ${importResult.stats.inserted}`);
            console.log(`   🔄 Updated: ${importResult.stats.updated}`);
            console.log(`   ⚠️  Conflicts: ${importResult.stats.conflicts}`);
            console.log(`   🔄 Duplicates: ${importResult.stats.duplicates}`);
            console.log(`   ❌ Errors: ${importResult.stats.errors}`);
            console.log(`   ⏭️  Skipped: ${importResult.stats.skipped}`);
            
            // Step 4: Log file analysis
            if (importResult.logFile && fs.existsSync(importResult.logFile)) {
                console.log('\n📄 Step 4: Log File Analysis');
                console.log('============================');
                console.log('📋 Log File:', importResult.logFile);
                
                const logContent = fs.readFileSync(importResult.logFile, 'utf8');
                const lines = logContent.split('\n');
                console.log(`   📊 Log file size: ${lines.length} lines`);
                console.log(`   📄 Log file size: ${Math.round(logContent.length / 1024)} KB`);
                
                // Show first few lines of log
                console.log('\n📝 First 10 lines of log:');
                lines.slice(0, 10).forEach((line, index) => {
                    console.log(`   ${index + 1}: ${line}`);
                });
            }
            
            console.log('\n✅ Simple test completed successfully!');
            console.log('\n📋 Next Steps:');
            console.log('   1. Check the generated log file for detailed analysis');
            console.log('   2. Review the database to see which records were inserted');
            console.log('   3. Test the web interface with the same file');
            console.log('   4. Use the Log Viewer in the web interface to review conflicts');
            
        } else {
            console.log('❌ Import failed:', importResult.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        // Clean up test file
        try {
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log('\n🧹 Cleaned up test file:', filepath);
            }
        } catch (cleanupError) {
            console.warn('⚠️  Could not clean up test file:', cleanupError.message);
        }
    }
}

// Run the simple test
runSimpleTest().catch(console.error);

