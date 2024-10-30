const express =require('express');
const { PrismaClient, deliverytype, Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const router = express.Router(); 
const db = new PrismaClient();    
const ssecontroller = require('./admin_sse');
const admin = require('firebase-admin/app');  
const { getStorage } = require('firebase-admin/storage');
const { initializeApp, cert } = require('firebase-admin/app');
const fs = require('fs');  

const path = require('path');  
const multer = require('multer');  
const serviceaccount  = require('../utils/firebase_service_account.json'); 


initializeApp({
    credential:cert(serviceaccount), 
    storageBucket:'gs://groceryapp-970ff.appspot.com'

    
}) 
const bucket = getStorage().bucket(); 
const storage = multer.memoryStorage(); 
const upload = multer({storage:storage});
router.post('/register', async(req, res)=>{
    const {username, email, password} = req.body;  
    try{
       if(!username || !password || !email){
        return res.status(500).json({message:"Something went wrong"});
       }
        const use = await db.user.findFirst({where:{email:email}}); 
        if(user){
            return res.status(400).json({message: "User already exists"});
        } 
        const hassedpassword = await  bcrypt.hash(password, 10); 
        const newuser = await db.admin.create({data:{  username:username, password:hassedpassword, email:email}});  
        const token = jwt.sign({userid:newuser.id}, process.env.secret_key, );  
       
        return res.status(201).json(token);
        

    }catch(err){
        console.log("User sign up api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }
}) 
router.post('/login', async(req,res)=>{
    const{email, password} = req.body; 

    try{
        if( !password || !email){
            return res.status(500).json({message:"Something went wrong"});
        }
       const user = await db.admin.findUnique({where:{email:email}}); 
       if(!user){
          return res.status(500).json({message:"User not found"});  
       } 
       const ismatch = await bcrypt.compare(password, user.password); 
       if(!ismatch){
        console.log("unauthorized",)
         return res.status(404).json({message:"Unauthorized"});  
        
       } 
       const token = jwt.sign({userid:user.id}, process.env.secret_key, );   
       
       return res.status(200).json(token );
    }catch(err){
        console.log("User login api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }
})
router.post('/product',upload.array('images', 10), async(req, res)=>{
    try{
      const {name, price, details, category, unitname, unitvalue, nutrition, userId, nutritionweight } = req.body;  
      console.log(price);  
      let parsednutrition; 
      if(typeof  nutrition === 'string'){
        parsednutrition =JSON.parse(nutrition);
      }else{
        parsednutrition = nutrition;
      }
      console.log(parsednutrition);
      const files = req.files;   
      const converprice  = parseFloat(price); 
      if(!files || files.length ===0) return res.status(400).json({message:"Image is required"});  
      const imageUrls =[]; 
      for(const file of files){
        const filename = Date.now() + "_" + file.originalname;    
        const fileUpload = bucket.file(filename); 

        const blobstream = fileUpload.createWriteStream({
            metadata:{
                contentType:file.mimetype,
            }
          })   
        await new Promise((resolve, reject) =>{
            blobstream.on('error', (err) => {
                console.log("Error uploading file: " + err);
                reject( res.status(500).json({message:"Error uploading file"}));
              }) 
            blobstream.on('finish', async()=>{
                const[url] = await fileUpload.getSignedUrl({
                    action:"read", 
                    expires: "03-01-3500"
                }) 
                imageUrls.push(url); 
                resolve();
            }); 
            blobstream.end(file.buffer);  
           
;
        }) 
      }
      
      
    
     
      console.log(converprice)
      
    
      const product = await db.product.create(
        {
            data:{
                name:name,
                price:converprice,
                details:details, 
                sellerId:userId, 
                nutritionweight:nutritionweight,
                
                category:category, 
                unit_name:unitname, 
                unit_value:unitvalue,  
                Image:imageUrls, 
               
                

            }
        }
      ) 
      for(const item of parsednutrition){
        await db.nutrition.create({
          data:{
            productId:product.id,    
            nutrionName:item.name, 
            nutritionValue:item.value,
          }
        })
      }
      
     
      
      return res.status(201).json({product:product});
    }catch( err){   console
        console.log("Product Creation api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }
})

router.get('/products', async(req, res)=>{
  const sellerId = req.params.sellerId;  
  try{
    const products = await db.product.findMany({
      where:{
        sellerId:sellerId
      },
     
      include:{
        nutriion:true,
        
      },
      orderBy:{
        createdAt:"desc"
      } 

    }) 
    console.log(products);
    return res.status(200).json({products:products});
  }catch(err){
    console.log("Product Creation api error: " + err); 
    return res.status(500).json({message:"Something went wrong"});
  }

}) 
router.delete('/products', async(req, res)=>{ 
  const prod_Id = req.query.prod_Id;
  try{
      await db.product.delete({
      where:{
        id:prod_Id
      }
     }) 
     senddeleteEvent(prod_Id);
     return res.status(200).json({message:"Product deleted successfully"});
  }catch(err){
    console.log("Product Creation api error: " + err); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.post('/offer', async(req,res)=>{
  try{
    const{id, price, startdate, enddate, seller_id}= req.body;  
    console.log(req.body);
    const converprice  = parseFloat(price); 
    const offer = await db.offer.create({
      data:{
        productId:id,   
        price:converprice,  
        start_date:new Date(startdate), 
        end_date:new Date(enddate), 
        seller_id:seller_id,

      }
    })
    return res.status(200).json({offer:offer});
  }catch(err){
    console.log("Offer Creation api error: " + err); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.post('/promo', async(req, res)=>{
  try{
     const{userId, title, Prmocode,desc, offerprice, max_order_amount, startdate, enddate, max_dis_amount, type} = req.body; 
     const promo = await db.promo.create({
       data:{
         Title:title, 
         PromoCode:Prmocode,  
         Description:desc,  
         Offerprice:offerprice,  
         start_date:new Date(startdate), 
         end_date:new Date(enddate), 
         Max_Discount_amount:max_dis_amount, 
         min_order_price:max_order_amount, 
         userId:userId, 
         type:type


       }
     })
     return res.status(200).json({promo:promo});
  }catch(err){
    console.log("Promo Creation api error: " + err); 
   
  }
})
router.put('/product',upload.array('images', 10), async(req, res)=>{
  try{
    const prodId = req.query.prodId;
    const {name, price, details, category, unitname, unitvalue, nutrition, userId, nutritionweight,existimgImageUrls } = req.body;  
    console.log(price);  
    let parsednutrition; 
    let parsedExistingImageUrls = existimgImageUrls?JSON.parse(existimgImageUrls):[];

    if(typeof  nutrition === 'string'){
      parsednutrition =JSON.parse(nutrition);
    }else{
      parsednutrition = nutrition;
    }
    console.log(parsednutrition);
    const files = req.files;   
    const converprice  = parseFloat(price); 
    
    const imageUrls =[...parsedExistingImageUrls]; 
    if(files && files.length > 0){
    for(const file of files){
      const filename = Date.now() + "_" + file.originalname;    
      const fileUpload = bucket.file(filename); 

      const blobstream = fileUpload.createWriteStream({
          metadata:{
              contentType:file.mimetype,
          }
        })   
      await new Promise((resolve, reject) =>{
          blobstream.on('error', (err) => {
              console.log("Error uploading file: " + err);
              reject( res.status(500).json({message:"Error uploading file"}));
            }) 
          blobstream.on('finish', async()=>{
              const[url] = await fileUpload.getSignedUrl({
                  action:"read", 
                  expires: "03-01-3500"
              }) 
              imageUrls.push(url); 
              resolve();
          }); 
          blobstream.end(file.buffer);  
         
;
      }) 
    }
  }
    
  
   
    console.log(converprice)
    
  
    const product = await db.product.update(

      {
        where:{
           id:prodId, 
           sellerId:userId
          
        },
        
          data:{
              name:name,
              price:converprice,
              details:details, 
              sellerId:userId, 
              nutritionweight:nutritionweight,
              
              category:category, 
              unit_name:unitname, 
              unit_value:unitvalue,  
              Image:imageUrls, 
             
              

          }
      }
    ) 
    console.log(parsednutrition);
    await db.nutrition.deleteMany({
      where:{
        productId:prodId
      }
    })
    for(const item of parsednutrition){
     
      console.log(parsednutrition);
      await db.nutrition.create({
        
        data:{
          productId:prodId,
          nutrionName:item.name, 
          nutritionValue:item.value,
        }
      })
    }
  
   
    
    return res.status(201).json({product:product});
  }catch( err){   console
      console.log("Product Creation api error: " + err); 
      return res.status(500).json({message:"Something went wrong"});
  }
})
router.get("/getproducts", async(req, res)=>{
  const id = req.params.id;  
  try{
    const products = await db.product.findMany({
      where:{
        id:id,
      }, 
      
      orderBy:{
        createdAt:"desc"
      },  
      include:{
        nutriion:{
          where:{
            productId:id,
          }
        }
      }

    }) 
    return res.status(200).json({products:products})
  }catch(err){
    console.log("Product Creation api error: " + err); 
      return res.status(500).json({message:"Something went wrong"});
  }
}) 
router.get('/offer', async(req, res)=>{
  const userId = req.query.userId;  
  try{
    const offer = await db.offer.findMany({
      where:{
          seller_id:userId,
      },
      include:{
        product:{
          include:{
            nutriion:true,
          }
        }
      }
    })
    console.log(offer);
    return res.status(200).json({offer:offer});
  }catch(e){
    console.log("Offer_get api error: " + e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.delete('/offer', async(req, res)=>{ 
  const id = req.query.id;

try{
    const offer = await db.offer.delete({
      where:{
          id:id,
      },
     
    })
    console.log(offer);
    return res.status(200).json({offer:offer});
  }catch(e){
    console.log("Offer_get api error: " + e); 
    return res.status(500).json({message:"Something went wrong"});
  }
});
router.patch("/offer", async(req, res)=>{
  const id = req.query.id;
  try{
    const{ price, startdate, enddate, seller_id}= req.body;  
    console.log(req.body);
    const converprice  = parseFloat(price); 
    const offer = await db.offer.update({
      where:{
        id:id,
      },
      data:{
         
        price:converprice,  
        start_date:new Date(startdate), 
        end_date:new Date(enddate), 
        seller_id:seller_id,

      }
    })
    return res.status(200).json({offer:offer});
    i
  }catch(err){
    console.log("Offer Creation api error: " + err); 
    return res.status(500).json({message:"Something went wrong"});
  }
}) 
router.get('/promo', async(req, res)=>{
  const sellerid = req.query.sellerid;
  try{
     const promo = await db.promo.findMany({
      where:{
        userId:sellerid,
      } 


     })
     return res.status(200).json({promo:promo});
  }catch(err){
    console.log("Promo get api error: " + err); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.patch("/promo", async(req, res)=>{
  const id = req.query.id; 
  try{
    const{userId, title, Prmocode,desc, offerprice, max_order_amount, startdate, enddate, max_dis_amount, type} = req.body; 
    const promo = await db.promo.update({
      where:{
         id:id,
      },
      data:{
        Title:title, 
        PromoCode:Prmocode,  
        Description:desc,  
        Offerprice:offerprice,  
        start_date:new Date(startdate), 
        end_date:new Date(enddate), 
        Max_Discount_amount:max_dis_amount, 
        min_order_price:max_order_amount, 
        userId:userId, 
        type:type


      }
    })
    return res.status(200).json({message:"Updated Sucessfully"});
  }catch(e){
      console.log("Promo_patch api error: " + e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.get("/order", async(req, res)=>{
  const sellerId = req.query.sellerId; 
  try{
    const orders  = await db.order.findMany({
      where:{
        sellerId:sellerId,
      }, 
      
      orderBy:{
        createdAt:"desc"
      }
    }) 
    const orderWithProducts = await Promise.all(
      orders.map(async(order)=>{
        const orderproduct = await db.orderProduct.findMany({
          where:{
            order_id:order.id,
          }, 
          include:{
            product:true
          }
        }) 
        const address = await db.adress.findFirst({
          where: {
            id:order.address_id, // assuming address is linked by sellerId
          },
        });
        const productnames = orderproduct.map((op)=>op.product.name); 
        const firstproductImage = orderproduct.length >0 ?orderproduct[0].product.Image[0]:null;     
        return{
          ...order,  
          firstproductImage:firstproductImage, 
          productnames:productnames,
        
          city:address?address.city:"",  
          address:address?address.adressline:'', 
          state:address?address.state:"",  
          postalcode:address?address.postalCode:"",
          

          
        }
      })
    )
    console.log(orderWithProducts)
   return res.status(200).json({order:orderWithProducts});
  }catch(e){
    console.log("Promo_patch api error: " + e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.patch("/order", async(req, res)=>{
  const id = req.query.id; 
  const {status} = req.body;  
  
  console.log(id);
  console.log(status);
  try{
  const order = await db.order.update({
      where:{
        id:id
      }, 
      data:{
        order_status:status,
      }
    })
   
   
   
    
    return res.status(200).json({status:status});
  }catch(e){
    console.log("Order api error: " + e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.get('/orderdetails', async(req, res)=>{ 
  const orderId = req.query.orderId; 
  try{ 
   
   const order = await db.order.findUnique({
     where:{
       id:orderId
     }, 
    
   }) 
   const address = await db.adress.findFirst({
     where:{
       id:order.address_id
     }
   })
   const orderproducts = await db.orderProduct.findMany({
     where:{
       order_id:orderId,
     },
     include:{
       product:true,
     }
   })
     const products = orderproducts.map(item=>({
       id:item.product_id,   
       name:item.product.name,  
       Image:item.product.Image[0],  
       price:item.product.price,    
       qty:item.qty, 
       unit_name:item.product.unit_name,    
       unit_value:item.product.unit_value,   


     }))
   var orderdetails={
   payment_type: order.payment_type,  
   order_status:order.order_status, 
   payment_status:order.payment_status,  
   //qty:order.qty,  
   address:address ?address.adressline:"", 
   city: address?address.city:"", 
   state: address?address.state:"", 
    
   price:order.total_price, 
   deliverytype:order.delivery_type =="Delivery"?"Delivery":"Collection",  
   createdAt:order.createdAt, 
    postalcode: address?address.postalCode:"", 
    product:products,
       
       
     }
     console.log(orderdetails);
  

   
   res.status(200).json({order:orderdetails});

  }catch(e){
   console.log("Error_payment_api_online", e); 
   return res.status(500).json({message:"Something went wrong"});
  }
}) 

module.exports = router;

