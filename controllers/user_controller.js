const express = require('express'); 
const { PrismaClient, deliverytype, Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const router = express.Router(); 
const db = new PrismaClient(); 
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3'); 
const { orders } = require('@edribeiro/checkout-server-sdk');
const loaldb = new sqlite3.Database('verification.db'); 
loaldb.serialize(()=>{
  loaldb.run("CREATE TABLE IF NOT EXISTS verifications_codes (email TEXT PRIMARY KEY, code TEXT)");
})
let verificationCodes ={}
  
const transporter = nodemailer.createTransport({
  service:'gmail', 
  auth:{
    user:'n18558507@gmail.com', 
    pass:process.env.pass
  }
})

router.post("/sign_up", async (req, res)=>{
    const {username, email, password} = req.body;  
    try{
       if(!username || !password || !email){
        return res.status(500).json({message:"Something went wrong"});
       }
        const user = await db.user.findFirst({where:{email:email}}); 
        if(user){
            return res.status(400).json({message: "User already exists"});
        } 
        const hassedpassword = await  bcrypt.hash(password, 10); 
        const newuser = await db.user.create({data:{  username:username, password:hassedpassword, email:email}});  
        const token = jwt.sign({userid:newuser.id}, process.env.secret_key, );  
       
        return res.status(201).json(token);
        

    }catch(err){
        console.log("User sign up api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }
}) 
router.post('/login', async(req, res)=>{
    const{email, password} = req.body; 

    try{
        if( !password || !email){
            return res.status(500).json({message:"Something went wrong"});
        }
       const user = await db.user.findUnique({where:{email:email}}); 
       if(!user){
          return res.status(404).json({message:"User not found"});  
       } 
       const ismatch = await bcrypt.compare(password, user.password); 
       if(!ismatch){
         return res.status(404).json({message:"Unauthorized"}); 
       } 
       const token = jwt.sign({userid:user.id}, process.env.secret_key, );   
       
       return res.status(200).json(token );
    }catch(err){
        console.log("User login api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }
})
router.post('/address', async(req, res) => {
    const{name, mobile, adressline, city, state,  postalcode, userId, type} = req.body;  
   
    try{
      const user = await db.user.findUnique({where:{id:userId}}); 
      if(!user){
         return res.status(404).json({message:"User not found"});
      } 
      const newadress = await db.adress.create({data:{
         name:name, 
         mobilenumber:mobile, 
         adressline:adressline,
         city:city, 
         state:state, 
         postalCode:postalcode, 
         userId:userId, 
         type:type,
      }}) 
       return res.status(201).json(newadress);
    }catch(err){
        console.log("adress api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }
    
}) 
router.get('/home', async(req, res)=>{ 
   const userId = req.query.userId;
  
    try{
      
       let location = await db.location.findFirst({
        where:{userId:userId}
       })
       if(!location){
        if(!location){
          location ={
            "state":"Assam", 
             "city":"Jorhat"
          }
         }   
       }
       



       const latestProduct = await db.product.findMany({  
        where:{
            order:{
              some:{}
            }
        },
        include:{
         _count:{
          select:{
            order:true,
          }
         }
        },  
        orderBy:{
         order:{
          _count:'desc',
         }
        },
        
      take:5,
      
      
       
       }); 
       const offer = await db.offer.findMany({
         where:{
            end_date:{gt:new Date()}
         }, 
         include:{
            product:true,
         }
       }); 

       const offeredproducts = offer.map((offer)=>offer.product.id);
       const otherPoructs = await db.product.findMany( 
         {
            where:{
                NOT:{id:{in:offeredproducts}}
            },
            take:10
         }
          
       );  
       
      
         
       
      return res.json({
         location,
         latestProduct, 
        offer: offer != null &&offer, 
         otherporucts:otherPoructs
       })
       
    }catch(err){
        console.log("Home api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }
    
})
router.get('/details', async(req, res)=>{ 
    try{
        const id = req.query.id;
        const userId = req.query.userId;
        
        let price;
       
       const product = await db.product.findFirst({where:{id:id}});  
       const offer = await db.offer.findFirst({where:{productId:product.id, end_date:{gte:new Date()}}});  
       const cart = await db.cart.findFirst({where:{prod_id:product.id, userId:userId}});
       const averageRating = await db.review.aggregate({
        where:{
          productId:product.id,
        }, 
        _avg:{
          rating:true
        }
       })
       if(!product){
         return res.status(404).json({message:"Product not found"});

       }  
       const fav = await db.fav.findFirst({
        where:{productId:product.id, userId:userId}
       }) 
      
       const nutrition = await db.nutrition.findMany({
        where:{
          productId:product.id,
        }
       })
       
       if(offer){
         price = offer.price;
       }else{
         price = product.price;
       }
       var products = {
           name:product.name, 
           image:product.Image,  
           price:price,
           details:product.details, 
           unitvalue:product.unit_value, 
           unitname:product.unit_name,
           nutritions:nutrition,
           id:product.id,  
           status:fav?fav.status:false, 
           cart_id:cart ?cart.prod_id: "", 
           nutritionweight:product.nutritionweight,
           averageRating:averageRating._avg.rating == null ? "0.00" : averageRating._avg.rating

       }
       return res.json({details:products});
    }catch(err){
        console.log("Details api error: " + err); 
        return res.status(500).json({message:"Something went wrong"});
    }

})
router.post('/addtocart', async(req, res)=>{
    const {productId,qty, userId,price} = req.body;  
  
  
     
    try{
      const product = await db.product.findUnique({where:{id:productId}}); 
      
      if(!product){
        return res.status(404).json({message:"Product not found"});
     } 
     if(!userId){
       return res.status(404).json({message:"User not found"});
     } 
      
     const carts = await db.cart.findFirst({where:{prod_id:productId, userId:userId}});
     
     if(carts){
      const newqty = carts.qty + 1;
      const cart = await db.cart.update({
        where:{
          id:carts.id,

        },
        data:{
          qty:newqty,   
          price:price*newqty,


        }
      })
      return res.status(200).json({cart:cart});
         
     }else{
      const cart = await db.cart.create({
        data:{
          prod_id:product.id, 
          qty,
          userId:userId, 
          price:price,
        }
      }); 
      return res.status(200).json({cart:cart});
     }
       
      
    
      
      
    }catch(e){
        console.log("Error_addtocart_api", e); 
        res.status(500).json({message:"Something went wrong"});
    }
    
})
router.post('/fav', async(req, res) => {
   const{productId, userId} = req.body; 
   console.log(productId); 
   console.log(userId);
   try{ 
    let fav;
     
     if(!productId){
      return res.status(404).json({message:"Product not found"});
     }
     const favexist =  await db.fav.findFirst({
      
      where:{ productId:productId, userId:userId}

      
     }) 
     if(favexist){
        fav = await db.fav.delete({
          where:{id:favexist.id}
        }) 
        return res.status(200).json({status:false})
     }else{
         fav = await db.fav.create({
           data:{
            productId:productId, 
            userId:userId, 
            status:true
           }
         })
         const status = fav.status 
         return res.status(200).json({status:status});
     } 

     
      
      

     
   }catch(e){
        console.log("Error_favoritete_api", e); 
        res.status(500).json({message:"Something went wrong"});
    }
}) 
router.get('/favorites',async(req, res)=>{
  const userId = req.query.userId;  
  try{
     const favorites = await db.fav.findMany({
      where:{userId:userId},
      include:{
        product:true
      }

     }) 
     const finalproductlist  = await Promise.all(
      favorites.map(async(favorite)=>{
        const offer = await db.offer.findFirst({
          where:{productId:favorite.productId, end_date:{gte:new Date()} }
        }); 
        return {
          ...favorite.product,  
          price:offer?offer.price:favorite.product.price,
          productId:favorite.productId
        }
      })
      
     ) 
     console.log(finalproductlist);
     res.status(200).json({favproducts:finalproductlist});
  }catch(e){
    console.log("Error_favoritete_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }


}) 
router.get('/cartItems', async(req, res)=>{ 
   try{
     const userId = req.query.userId; 
     const cart = await db.cart.findMany({
       where:{userId:userId},  
       include:{
         product:true
       }
         

     })  
     const finallist = await Promise.all(
      cart.map(async(carts)=>{
        const offer = await db.offer.findFirst({
          where:{
            productId:carts.prod_id, end_date:{gte:new Date()}
          }
        })
        return{
          
          name:carts.product.name, 
           image:carts.product.Image[0], 
           prod_id:carts.prod_id,
           unit_name:carts.product.unit_name, 
           unit_value:carts.product.unit_value,
           qty:carts.qty,
           price:offer?offer.price * carts.qty:carts.product.price * carts.qty,
           original_price:offer?offer.price:carts.product.price
        }

      })
     )
     console.log(finallist);
     res.json({cart:finallist});
     
   }catch(e){
    console.log("Error_favoritete_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
})
 router.patch('/cartItems', async(req, res)=>{
    const {productId, qty, price, userId} = req.body; 
    try{ 
      const cartItems = await db.cart.findFirst({where:{prod_id:productId, userId:userId }});  
      if(!cartItems){
        return res.status(404).json({message:"Item not found"});
      } 
      const cart = await db.cart.update({
        where:{id:cartItems.id,}, 
        data:{
           price:price, 
           qty:qty,
        }
      })
        return res.status(200).json({cart:cart});
    }catch(e){
      console.log("Error_cartitemsedit_api", e); 
     res.status(500).json({message:"Something went wrong"});
    }
    
 })
 router.delete('/cartitem', async(req, res)=>{
   const productId = req.params.productId;
    const  userId = req.query.userId; 
    try{
      const cartitem = await db.cart.findFirst({
        where:{prod_id:productId, userId:userId}
      }); 
      if(!cartitem){
         return res.status(404).json({message:"Item not found"});
      } 
      const  Itemdeleted = await db.cart.delete({
        where:{id:cartitem.id, }, 

      }) 
      return res.status(200).json({message:"Item deleted successfully"});
    }catch(e){
      console.log("Error_cartitemsedit_api", e); 
      res.status(500).json({message:"Something went wrong"});
    }
 }) 

 router.get('/search', async(req, res) => { 
  const searchterm = req.query.searchterm;
 
  try{
      const products = await db.product.findMany({
        where:{
          OR:[
             {
              name:{
                startsWith:searchterm, 
                mode:'insensitive'// Case-insensitive search
              }, 
              name:{
                contains:searchterm, 
                mode:'insensitive'//case-intensive search
              }, 
             
              
            }
          ]
          
        }, 
        include:{
          product:{
            where:{
              end_date:{gte:new Date()}
            },
            take:1
          }
        }, 
        


      })  
      
      const finallist = await Promise.all(
        products.map(async(search)=>{
         const offer = search.product.length > 0 ? search.product[0]:null;
          return{
            name:search.name, 
            id:search.id, 
            price:offer?offer.price:search.price, 
            Image:search.Image,
            unit_name:search.unit_name, 
            unit_value:search.unit_value, 
            createdAt:search.createdAt,
            updatedAt:search.updatedAt,
          }
  
        })
      )
       return res.status(200).json({search:finallist});
      
     
  }catch(e){
    console.log("Error_search_api", e); 
      res.status(500).json({message:"Something went wrong"});
  }
 
 }) 
 router.get('/category', async(req, res)=>{
  try{
     const  category = req.query.category; 
     const products =  await db.product.findMany({
       where:{category:category}, 
       include:{
        product:{
          where:{
            end_date:{gte:new Date()}
          },
          take:1
        }
      }, 

       
     }); 
     const finallist = await Promise.all(
      products.map(async(cat)=>{
        const offer = cat.product.length > 0 ? cat.product[0]:null;
        return{
          name:cat.name, 
          id:cat.id, 
          price:offer?offer.price:cat.price, 
          Image:cat.Image,
          unit_name:cat.unit_name, 
          unit_value:cat.unit_value, 
          createdAt:cat.createdAt,
          updatedAt:cat.updatedAt,
        }

      })
    )
    return res.status(200).json({catproduct:finallist});
  }catch{
    console.log("Error_category_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
 })
router.get('/user', async(req, res)=>{
  try{
    const userId = req.query.userId; 
    if(!userId){
       return res.status(404).json({message:"User not found"});   
    }
    const user  = await db.user.findFirst({
      where:{id:userId}
    })
    var data = {
      name:user.username,
      email:user.email, 
      mobileNumber:user.mobileNumber, 
      countryCode:user.countryCode,
     
    } 
    console.log(data);
    res.status(200).json({userdata:data});
  }catch(e){
    console.log("Error_category_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
})
router.post('/location', async(req, res)=>{
  const{userid, city, state} = req.body;
  try{
    const  location  = await db.location.create({
      data:{
        userId:userid,
        city:city,
        state:state,
      }
     
    })
    return res.status(200).json(location);
  }catch(e){
    console.log("Error_location_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
})
router.get("/address", async(req, res)=>{
  const userId = req.query.userId; 
  if(!userId){
     return res.status(404).json({message:"Something went wrong"});
  }
  try{
    const address = await db.adress.findMany({
      where:{userId:userId}
    })
    return res.status(200).json({address:address});
  }catch(e){
    console.log("Error_location_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
})
router.delete("/address", async(req, res)=>{
  const id = req.query.id;  
  try{ 
    const address = await db.adress.delete({
      where:{id:id}
    })
    return res.status(200).json({message:"deleted Sucessfully"});

  }catch(e){
    console.log("Error_location_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
}) 
router.patch('/address', async(req, res)=>{ 
  try{
    const{name, mobile, adressline, city, state,  postalcode, type} = req.body;  
    const id = req.query.id;

    console.log(req.body);
    const adress = await db.adress.update({
      where:{id:id}, 
      data:{
       name:name, 
       mobilenumber:mobile, 
       adressline:adressline, 
       city:city, 
       state:state, 
       postalCode:postalcode, 
       type:type
      }
    })
    return res.status(200).json({adress:adress});
  }catch(e){
    console.log("Error_location_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }

}); 
router.post('/payment', async (req, res) => {
  try{
    const{name, cardno, month, year, userId} = req.body; 
    const carddetails = await db.payment.create({
      data:{
        name:name,  
        cardno:cardno, 
        month:month,
        year:year,  
        userId:userId,
      }
    }); 
    return res.status(200).json({carddetails:carddetails});
  }catch(e){
    console.log("Error_add-payment_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
}) 
router.get('/payment', async(req, res)=>{
  const userId = req.query.userId; 
  try{
    const payment = await db.payment.findMany({
      where:{userId:userId}
    })
    return res.status(200).json({payment:payment});
  }catch(e){
    console.log("Error_payment_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
})
router.delete('/payment', async(req, res)=>{
  const id = req.query.id; 
  try{
    const payment = await db.payment.delete({
      where:{id:id}
    }) 
    return res.status(200).json({payment:payment});
  }catch(e){
    console.log("Error_payment_api", e); 
    res.status(500).json({message:"Something went wrong"});
  }
})


router.post("/online", async(req, res)=>{
  const{userId, products, total_price,user_pay_price, payment_type, delivery_type, address_id, delivery_price,discountprice } = req.body;    
   try{
  
        

        
       
           const order = await db.order.create({
              data:{
                userId:userId, 
                total_price:total_price, 
                delivery_price:delivery_type ==="collection"?0.00:20,  
                user_pay_price:user_pay_price, 
                payment_type:payment_type, 
                address_id:address_id,  
                discountPrice:discountprice,
                delivery_type:delivery_type,
                
                
                payment_status:"done", 
                products:{
                  create:products.map((product)=>({
                    product:{connect:{id:product.productid}}, 
                    qty:product.qty,
                  }))
                }
      
              }
            })
           
           await db.cart.deleteMany({
            where:{userId:userId}
           })
           return res.status(200).json({order:order})
        
        
   }catch(e){
    console.log("Error_payment_api_online", e); 
    return res.status(500).json({message:"Something went wrong"});
   }

 

})  
router.get("/order", async(req, res)=>{
   const userId = req.query.userId; 
   try{
        const orders  = await db.order.findMany({
          where:{userId:userId}, 
          
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
            const productnames = orderproduct.map((op)=>op.product.name); 
            const firstproductImage = orderproduct.length >0 ?orderproduct[0].product.Image[0]:null;  
            return{
              ...order,  
              productnames:productnames, 
              firstproductImages:firstproductImage,
              
            }
          })
        )
        console.log(orderWithProducts)
       return res.status(200).json({order:orderWithProducts});
   }catch(e){
    console.log("Error_payment_api_online", e); 
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
router.post('/review', async(req,res)=>{
  try{ 
    const{userId, productId, rating, comment} = req.body; 
    if(!userId || !productId){
      return res.status(400).json({message:"userId and productId are required"});
    }
    const review = await db.review.create({
      data:{
        userId:userId, 
        productId:productId,
        rating:rating,
        comment:comment,
      }
    })
    return res.status(200).json({review:review});
  }catch(e){
    console.log("Error_review_api", e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.patch('/users', async(req,res)=>{
  try{
    const{name, email, mobileno, countrycode, userId} = req.body;  
    console.log(req.body);
    const user = await db.user.update({
      where:{id:userId}, 
      data:{
        username:name,  
        email:email, 
        mobileNumber:mobileno,  
        countryCode:countrycode

      }

    })
   
    return res.status(200).json(user);
  }catch(e){
    console.log("Error_review_api", e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
function geberateverification(){
  return Math.floor(1000 + Math.random() * 9000).toString();

} 
async function sendVerification(email, code){
  const mailOptions = {
    from:'n18558507@gmail.com',  
    to:email,  
    subject: 'Your Password reset Code',  
    text: `Your verification code is ${code}`

  }
  try{
         await transporter.sendMail(mailOptions);
  }catch (error) {
    console.error('Error sending email:', error);
  }
}
router.post('/verify', async(req, res) => {
  const {email} = req.body; 

  if(!email){
    return res.status(400).json({message:"Email is required"});
  } 
  const user  = await db.user.findFirst({where:{email:email}}); 
  if(!user){
    return res.status(404).json({message:"User not found"});
  }
  const verificationCode = geberateverification(); 
loaldb.run("INSERT OR REPLACE INTO verifications_codes (email, code) VALUES (?, ?)",[email, verificationCode],(err)=>{
if(err){
  return res.status(500).send("Server error: " + err.message)
}
}) 
  sendVerification(email, verificationCode).then(()=>res.status(200).json("Verificationcode sent"))
  .catch((error)=>res.status(500).json("ERROR SENDING Verification"))
})
 router.patch('/changepassword',async(req, res)=>{
  const{userId, password} = req.body; 
  try{
    const hassedpassword = await bcrypt.hash(password, 10); 
    const passwordupdate  = await db.user.update({
      where:{id:userId}, 
      data:{
        password:hassedpassword,
      }
    })
   
    return res.status(200).json({message:"Password updated"});
  }catch(e){
    console.log("Error_review_api", e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
// POST route to verify the code
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;

  // Check if email and code are provided
  if (!email || !code) {
    return res.status(400).send('Email and code are required');
  }
  loaldb.get("SELECT code FROM verifications_codes WHERE email = ?",[email],(err, row)=>{
    if(err){
      return res.status(500).send("Server error: " + err.message)
    }
    if(row && row.code === code){
      loaldb.run("DELETE FROM verifications_codes WHERE email = ?",[email]); 
      return res.status(200).send('Verification successful');
    }else{
      return res.status(500).send("Invalid code");
    }
  })
});
router.patch('/Forgotpassword',async(req, res)=>{
  const{email, password} = req.body; 
  try{
    const user = await db.user.findFirst({where:{email:email}}); 
    if(!user) return res.status(404).send("User not found");
    const hassedpassword = await bcrypt.hash(password, 10);  
    const passwordupdate  = await db.user.update({
      where:{id:user.id}, 
      data:{
        password:hassedpassword,
      }
    })
   
    return res.status(200).json({message:"Password updated"});
  }catch(e){
    console.log("Error_review_api", e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
router.post("/cart_fav", async(req, res)=>{
  try{
    const{products, userId} = req.body; 
    const favproducts = await db.fav.findMany({
      where:{userId:userId},
      include:{
        product:true,
      }
    })  
     const existingcard = await db.cart.findMany({
       where:{userId:userId},   
       select:{product:true}
     }) 
     const existingproductIDs = existingcard.map(item=>item.prod_id); 
     const cart = await Promise.all(
       favproducts.map(async(favproduct)=>{
        if(!existingproductIDs.includes(favproduct.productId)){
          return db.cart.create({
            data:{
              userId:userId,  
              prod_id:favproduct.productId,  
              qty:1,  
              price:favproduct.product.price,

            }
          })
        }
       })
     );
   
     await db.fav.deleteMany({
      where:{
        userId:userId,
      }
     })
     return res.status(200).json({cart:cart});
  }catch(e){
    console.log("Error_review_api", e); 
    return res.status(500).json({message:"Something went wrong"});
  }
}) 

router.get('/promo', async(req, res)=>{
  try{
     const promo = await db.promo.findMany({
      where:{
        end_date:{
          gt:new Date()
        }
      },
      take:5, 
      
      
     }) 
     return res.status(200).json({promo:promo});
  }catch(e){
    console.log("promo_api_get", e); 
    return res.status(500).json({message:"Something went wrong"});
  }
})
module.exports = router;