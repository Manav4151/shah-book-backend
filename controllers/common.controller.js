import Publisher from '../models/publisher.schema.js';
import Customer from '../models/customer.schema.js';

/**
 * @description Create a new publisher
 * @route POST /api/v1/publishers
 * @access Private
 */
export const createPublisher = async (req, res) => {
    try {
        const { name,email,contactPersonEmail,contactPersonPhone, contactPerson , address } = req.body;

        if (!name && !email) {
            return res.status(400).json({ message: 'Publisher name and email is required.' });
        }

        const existingPublisher = await Publisher.findOne({ name: new RegExp(`^${name}$`, 'i') , email: new RegExp(`^${email}$`, 'i') });
        if (existingPublisher) {
            return res.status(409).json({ message: 'A publisher with this name already exists.' });
        }
        if (email) {
            const existingPublisher = await Publisher.findOne({ 'email': email });
            if (existingPublisher) {
                return res.status(409).json({ message: 'A publisher with this email already exists.' });
            }
        }
        const newPublisher = new Publisher({ name, contactPersonEmail,contactPersonPhone, contactPerson, address, });
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
        const { name,email, contactPerson,contactPersonEmail,contactPersonPhone, address } = req.body;

        if (!name && !email  ) {
            return res.status(400).json({ message: 'Customer name or email is required.' });
        }

        if (email) {
            const existingCustomer = await Customer.findOne({ 'email': email });
            if (existingCustomer) {
                return res.status(409).json({ message: 'A customer with this email already exists.' });
            }
        }

        const newCustomer = new Customer({ name, email, contactPerson,contactPersonEmail,contactPersonPhone, address });
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