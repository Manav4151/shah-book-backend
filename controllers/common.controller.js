import Publisher from '../models/publisher.schema.js';
import Customer from '../models/customer.schema.js';

/**
 * @description Create a new publisher
 * @route POST /api/v1/publishers
 * @access Private
 */
export const createPublisher = async (req, res) => {
    try {
        const { name, email, phone, contactPersonEmail, contactPersonPhone, contactPerson, address } = req.body;

        if (!name && !email) {
            return res.status(400).json({ message: 'Publisher name and email is required.' });
        }

        const existingPublisher = await Publisher.findOne({ name: new RegExp(`^${name}$`, 'i'), email: new RegExp(`^${email}$`, 'i') });
        if (existingPublisher) {
            return res.status(409).json({ message: 'A publisher with this name already exists.' });
        }
        if (email) {
            const existingPublisher = await Publisher.findOne({ 'email': email });
            if (existingPublisher) {
                return res.status(409).json({ message: 'A publisher with this email already exists.' });
            }
        }
        const newPublisher = new Publisher({ name, email, phone, contactPersonEmail, contactPersonPhone, contactPerson, address, });
        await newPublisher.save();

        return res.status(201).json({
            message: 'Publisher created successfully.',
            data: newPublisher,
        });
    } catch (error) {
        console.error('Error creating publisher:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * @description Create a new customer
 * @route POST /api/v1/customers
 * @access Private
 */
export const createCustomer = async (req, res) => {
    try {
        const { name, email, phone, discount,contactPerson, contactPersonEmail, contactPersonPhone, address } = req.body;

        if (!name && !email) {
            return res.status(400).json({ message: 'Customer name or email is required.' });
        }

        if (email) {
            const existingCustomer = await Customer.findOne({ 'email': email });
            if (existingCustomer) {
                return res.status(409).json({ message: 'A customer with this email already exists.' });
            }
        }

        const newCustomer = new Customer({ name, email , phone, discount, contactPerson, contactPersonEmail, contactPersonPhone, address });
        await newCustomer.save();

        return res.status(201).json({
            message: 'Customer created successfully.',
            data: newCustomer,
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Internal server error.' });
    }
};



// ... (keep your other controller functions like getBookSuggestions)

/**
 * @desc    Get publisher suggestions based on a search query.
 * @route   GET /api/books/publisher-suggestions
 * @access  Public
 */
export const getPublisherSuggestions = async (req, res) => {
    try {
        const { q } = req.query;

        // If the query is empty or too short, return an empty array
        if (!q || q.trim().length < 1) {
            return res.json({ success: true, publishers: [] });
        }

        // Perform a fuzzy search on the 'name' field using the text index
        // const publishers = await Publisher.find(
        //     { $text: { $search: q } },
        //     { score: { $meta: "textScore" } } // Rank results by relevance
        // )
        //     .sort({ score: { $meta: "textScore" } })
        //     .limit(10) // Limit to the top 10 results
        //     .select("name"); // Only return the name field

       

        const publishers = await Publisher.aggregate([
            {
                $search: {
                    // Make sure this index name matches the one you created in Atlas
                    index: 'publisher_autocomplete',
                    autocomplete: {
                        query: q,
                        path: 'name', // The field we are searching in
                        tokenOrder: 'sequential',
                        fuzzy: {
                            maxEdits: 1,      // Allow for 1 typo
                            prefixLength: 2,  // The typo can't be in the first 2 letters
                        }
                    }
                }
            },
            {
                // Limit the results for performance
                $limit: 10
            },
            {
                // Only return the fields we need
                $project: {
                    _id: 0,
                    name: 1
                }
            }
        ]);
         res.json({ success: true, publishers });
    } catch (error) {
        logger.error('Error fetching publisher suggestions:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching suggestions.' });
    }
};