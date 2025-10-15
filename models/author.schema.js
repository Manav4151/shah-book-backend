import { Schema, model } from 'mongoose';

const authorSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // Ensures no duplicate authors
      trim: true,
    },
    // You can add more fields here in the future
    // bio: { type: String },
    // birthDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

const Author = model('Author', authorSchema);
export default Author;