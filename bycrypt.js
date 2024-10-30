const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function createUser( password) {
  try {
    // Hash the password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create a new user in the database
    const user = await prisma.admin.update({ 
        where:{
           id:"cm0ypzix40000tts3gbmj2vzo"
        },
      data: {
        
       password: hashedPassword,
      },
    });

    console.log('User created:', user);
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Example usage
createUser(  'Admin@256');