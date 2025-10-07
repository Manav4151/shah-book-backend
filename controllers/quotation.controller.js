import Quotation from "../models/quotation.schema.js";

export const getQuotations = async (req, res) =>{
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const quotations = await Quotation.find({})
   
    .populate({
        path: 'items.book',
        select: 'title author isbn' // Select book details for each item
    })
    .sort({ createdAt: -1 }) // Show the most recent quotations first
    .skip(skip)
    .limit(limit);

const totalQuotations = await Quotation.countDocuments();

res.status(200).json({
    message: "Quotations fetched successfully",
    quotations,
    pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalQuotations / limit),
        totalItems: totalQuotations
    }
},);
};