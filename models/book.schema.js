
import { Schema, model } from 'mongoose';

const bookSchema = new Schema(
    {
        title: { type: String, default: null, trim: true },
    //    authors: [ 
            // // This is an array of author for separate authors schema.  
    //   {
    //     type: Schema.Types.ObjectId,
    //     ref: 'Author', // This creates the reference
    //   },
    // ],
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
        publisher_exclusive: { type: Boolean, default: false },
        classification: { type: String, default: null },
        remarks: { type: String, default: null },
        tags: { type: [String], default: [] },
    },
    { timestamps: true }
);

bookSchema.index({ title: 'text', author: 'text' });

const Book = model('Book', bookSchema);
export default Book;