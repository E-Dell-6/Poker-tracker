import mongoose from 'mongoose';

const PersonSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    name: {
        type: String,
        required: true,
        unique: false 
    },
    image: {
        type: String, 
        default: ""
    },
    tags: [
        {
            label: {
                type: String,
            },
            color: {
                type: String,
            }
        }
    ],
    notes: {
        type: String,
    }
});


const Person = mongoose.models.Person || mongoose.model('Person', PersonSchema);
export default Person;