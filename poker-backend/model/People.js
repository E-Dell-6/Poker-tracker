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
    },
    starred: {
        type: Boolean,
        default: false
    }
});


// findOrCreatePerson matches on (userId, name) case-insensitively. With
// no index that was a collection scan per lookup. Strength-2 collation
// makes the index itself case-insensitive, so an equality match on
// `name` can use it instead of the RegExp scan.
//
// The bulk import path doesn't rely on this (services/personResolver.js
// loads the set once into a Map), but every other caller does.
PersonSchema.index({ userId: 1, name: 1 }, { collation: { locale: 'en', strength: 2 } });

const Person = mongoose.models.Person || mongoose.model('Person', PersonSchema);
export default Person;