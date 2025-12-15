import Publisher from '../models/publisher.schema.js';
import Customer from '../models/customer.schema.js';
import { ROLES } from '../lib/auth.js';
import { logger } from 'better-auth';

/**
 * @description Create a new publisher
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
 */
export const createCustomer = async (req, res) => {
  try {
    const user = req.user;

    // 1️⃣ Validate Authentication
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const agentId = user.agentId;

    // 2️⃣ Prevent access if user is not system admin and has no agent
    if (!agentId) {
      return res.status(403).json({ message: "No agent assigned to this user" });
    }

    const {
      name,
      email,
      phone,
      discount,
      contactPerson,
      contactPersonEmail,
      contactPersonPhone,
      address,
    } = req.body;

    if (!name && !email) {
      return res.status(400).json({
        message: "Customer name or email is required.",
      });
    }

    // 3️⃣ Check duplicates inside this agent ONLY
    if (email) {
      const existing = await Customer.findOne({
        email,
        agentId, // scoped to tenant
      });

      if (existing) {
        return res.status(409).json({
          message: "A customer with this email already exists for your agent.",
        });
      }
    }

    // 4️⃣ Add agentId while saving
    const newCustomer = await Customer.create({
      name,
      email,
      phone,
      discount,
      contactPerson,
      contactPersonEmail,
      contactPersonPhone,
      address,
      agentId,
    });

    return res.status(201).json({
      message: "Customer created successfully.",
      data: newCustomer,
    });

  } catch (error) {
    console.error("Error creating customer:", error);
    return res.status(500).json({ message: "Internal server error." });
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
    const agentId = req.user?.agentId;
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, publishers: [] });
    }

    const publishers = await Publisher.find(
      { name: { $regex: q, $options: "i" } },
      { _id: 0, name: 1 } // only return name field
    ).limit(10);

    res.json({ success: true, publishers });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getCustomer = async (req, res) => {
  try {
    const agentId = req.user?.agentId;
    logger.info(`Agent ID: ${agentId}`);
    // System Admin → can view all customers (optional logic)
    const isSystemAdmin = req.user.role === ROLES.SYSTEM_ADMIN;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const searchQuery = {
      ...(search && {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }),
      ...(!isSystemAdmin && { agentId }) // Tenant filter applied only for non-system-admin
    };

    const [customers, total] = await Promise.all([
      Customer.find(searchQuery).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Customer.countDocuments(searchQuery)
    ]);

    return res.status(200).json({
      message: "Customers fetched successfully",
      customers: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
