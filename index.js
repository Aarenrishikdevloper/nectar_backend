const express = require('express');
const app = express(); 
const userRouter = require('./controllers/user_controller'); 
const sseAdminController = require('./controllers/admin_sse');
  // Pass the server to socket.io
const adminroute = require('./controllers/admin_controller');

const { type } = require('@prisma/client');
const path = require('path');
const port = 3000;
require('dotenv').config();
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/user',userRouter); 
app.use('/api/admin', adminroute); 
app.get('/api/sseadmin', sseAdminController.sseAdmin);


 app.listen(port, () => {
  console.log(`Server listening   
 on port ${port}`);
});   


