import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
  listPeople,
  createPerson,
  addTag,
  updateNotes,
  getStarred,
  deleteTag,
  replacePerson,
  updatePerson,
} from '../controllers/peopleController.js';

const router = express.Router();

router.use(userAuth);

router.get('/', listPeople);
router.post('/', createPerson);
router.post('/:personId/tags', addTag);
router.post('/:personId/notes', updateNotes);
router.get('/:personId/starred', getStarred);
router.delete('/:personId/tags/:tagLabel', deleteTag);
router.put('/:personId', replacePerson);
router.patch('/:personId', updatePerson);

export default router;
