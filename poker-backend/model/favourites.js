import mongoose from 'mongoose';

const FavoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
  hands: [{
    type: mongoose.Schema.Types.Mixed 
  }]
});

const favorite = mongoose.model.favorite || mongoose.model('Favorite', FavoriteSchema);
export default favorite;