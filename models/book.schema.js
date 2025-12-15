
import { Schema, model } from 'mongoose';

const bookSchema = new Schema(
    {
        title: { type: String, default: null, trim: true },
        agentId: {
        type: Schema.Types.ObjectId,
        ref: "Agent",
        required: true,
    },
        author: { type: String, default: null },
        edition: { type: String, default: null },
        year: { type: Number, default: null },
        publisher: {
            type: Schema.Types.ObjectId,
            ref: 'Publisher', // This links it to the Publisher model
            required: [true, 'Publisher is required']
        },
        isbn: { type: String, default: null, sparse: true },
        other_code: { type: String, default: null },
        imprint: { type: String, default: null },
        publisher_exclusive: { type: String, default: false },
        classification: { type: String, default: null },
        remarks: { type: String, default: null },
        tags: { type: [String], default: [] },
        outOfPrint: {
            type: Boolean,
            default: false, // false means book is still in print
            required: true
        }
    },
    { timestamps: true }
);
bookSchema.index({ agentId: 1 });
bookSchema.index({ title: 'text', isbn: 'text' , author: 'text'});

const Book = model('Book', bookSchema);
export default Book;