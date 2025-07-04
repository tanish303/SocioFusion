require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('./Models/db'); // MongoDB connection
const Signup = require('./Routes/Signup');
const Signin = require('./Routes/Signin');
const Resetpassword = require('./Routes/Resetpassword');
const CreatePost = require('./Routes/CreatePost');
const FetchPosts = require('./Routes/FetchPosts');
const FF = require('./Routes/Follow-Following');
const LikeUnlike = require('./Routes/LikeUnlike');
const SavePost = require('./Routes/SavePost');
const Comments = require('./Routes/Comments');
const Poll = require('./Routes/Poll');
const AccountInfo = require('./Routes/AccountInfo');





const app = express();
app.use(cors());
app.use(express.json());

app.use('/signup', Signup);
app.use('/signin', Signin);
app.use('/resetpassword', Resetpassword);
app.use('/createpost', CreatePost);
app.use('/fetchposts', FetchPosts);
app.use('/ff', FF);
app.use('/likeunlike', LikeUnlike);
app.use('/savepost', SavePost);
app.use('/comments', Comments);
app.use('/poll', Poll);
app.use('/account', AccountInfo);

const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
