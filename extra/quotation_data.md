1. add dummy data for quotation

## run following queary
// --- Step 1: Define ObjectIds from your actual data ---
// This is a placeholder for the customer. You would normally fetch this.
const customerId = new ObjectId("654a1b9c8d1f2e3a4b5c6d7e"); 

// IDs for "Advanced JavaScript" and "Data Structures and Algorithms" from your books collection
const bookId_JS = new ObjectId("68da4dd39fc0d715afd61cfc");
const bookId_DSA = new ObjectId("68da4dd39fc0d715afd61d02");

// --- Step 2: Construct the quotation items using your pricing data ---
const items = [
    {
        book: bookId_JS,
        quantity: 2,
        unitPrice: 59.99, // From bookpricings for this book
        discount: 5,       // From bookpricings for this book
        // totalPrice = 2 * 59.99 * (1 - 5/100) = 113.981
        totalPrice: 113.98
    },
    {
        book: bookId_DSA,
        quantity: 1,
        unitPrice: 69.99, // From bookpricings for this book
        discount: 15,      // From bookpricings for this book
        // totalPrice = 1 * 69.99 * (1 - 15/100) = 59.4915
        totalPrice: 59.49
    }
];

// --- Step 3: Calculate the overall totals ---
// In a real application, your backend code does this automatically.
const subTotal = 113.98 + 59.49; // 173.47

const totalDiscountAmount = (2 * 59.99 * 0.05) + (1 * 69.99 * 0.15); // 5.999 + 10.4985 = 16.4975

const grandTotal = subTotal;

// --- Step 4: Assemble and run the final insert query ---
db.quotations.insertOne({
    quotationId: "Q-2025-001", // This will be handled by your pre-save hook in the app
    customer: customerId,
    items: items,
    subTotal: subTotal,
    totalDiscount: totalDiscountAmount,
    grandTotal: grandTotal,
    status: "Draft",
    validUntil: new Date("2025-11-07T00:00:00.000Z"),
    createdAt: new Date(),
    updatedAt: new Date()
});

## How to Use It
Connect to your database using mongosh.

Select your database (e.g., use demo).

Paste the entire code block above into the shell and press Enter.

## if any thing needed use gemini chat 
**https://g.co/gemini/share/26b255c5a8a2**