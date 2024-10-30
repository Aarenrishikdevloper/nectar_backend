const products = [
    {
      name: "Apple",
      details: "Fresh and juicy apples",
      unit_name: "kg",
      unit_value: '1',
      Image: "https://firebasestorage.googleapis.com/v0/b/slack-44e51.appspot.com/o/apple.png?alt=media&token=9b05c002-5952-4066-9400-26feb2e874cf",
      category: "Fruits",
      price: 3.50,
    },
    {
      name: "Banana",
      details: "Sweet and ripe bananas",
      unit_name: "dozen",
      unit_value: '1',
      Image: "https://firebasestorage.googleapis.com/v0/b/slack-44e51.appspot.com/o/banana.png?alt=media&token=5401831d-b843-49ef-9d0c-a3128574e6f0",
      category: "Fruits",
      price: 1.20,
    },
    {
      name: "Carrot",
      details: "Fresh orange carrots",
      unit_name: "kg",
      unit_value: '1',
      Image: "https://www.google.com/imgres?q=carrot&imgurl=https%3A%2F%2Fwww.allthatgrows.in%2Fcdn%2Fshop%2Fproducts%2FCarrot-Orange.jpg%3Fv%1598079671&imgrefurl=https%3A%2F%2Fwww.allthatgrows.in%2Fdocid=H_FI5zbi9kuWvMHaAxBM&vet=12ahUKEwjfzPibkPeHAxXkUPUHHdNOEkgQM3oECBcQAA..i&w=1600&h=1250&hcb=2&ved=2ahUKEwi-5LqClfeHAxUpbPUHHdNOEkgQM3oECEwQAA",
      category: "Vegetables",
      price: 3.00,
    },
    {
      name: "Milk",
      details: "Full cream milk",
      unit_name: "litre",
      unit_value: '1',
      Image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTaC6MZf_tHDo0g68f15R_HZP0rJ8HuT2Useg&s",
      category: "Dairy",
      price: 1.50,
    },
    {
      name: "Eggs",
      details: "Farm fresh eggs",
      unit_name: "dozen",
      unit_value: '1',
      Image: "https://www.google.com/imgres?q=eggs&imgurl=https%3A%2F%2Fkidseatincolor.com%2Fwp-content%2Fuploads%2022/02/2Feggs-e648216369366.jpeg&imgrefurl=https%3A%2F%2Fkidseatincolor.com%2Fdocid=PI1gx5lAyloOUM&tnbid=6J19RJSrw-DDkM&vet=12ahUKEwi-5LqClfeHAxUpbPUHHbJCEYQM3oECBcQAA..i&w=1600&h=1250&hcb=2&ved=2ahUKEwi-5LqClfeHAxUpbPUHHdNOEkgQM3oECEwQAA",
      category: "Dairy",
      price: 2.00,
    },
    {
      name: "Bread",
      details: "Whole wheat bread",
      unit_name: "loaf",
      unit_value: '1',
      Image: "https://www.bonappetit.com/recipe/japanese-milk-bread",
      category: "Bakery",
      price: 9.00,
    },
    {
        name: "Pork", // Replace with your desired pork product name
        details: "Description of your pork product", // Add details about the pork product
        unit_name: "Kg",
        unit_value: '1',
        Image: "https://firebasestorage.googleapis.com/v0/b/slack-44e51.appspot.com/o/pork.png?alt=media&token=b8da5ff3-2950-45a1-b9a7-f8dcfc627d36", // Replace with the image URL
        category: "Non-Veg", // Changed to "Non-Veg"
        price: 10.00, // Replace with the actual price
      }, 
      {
        name: "Orange Juice",
        details: "Freshly squeezed orange juice",
        unit_name: "litre",
        unit_value: '1',
        Image: "https://firebasestorage.googleapis.com/v0/b/slack-44e51.appspot.com/o/orenge_juice.png?alt=media&token=f0ab17fd-a806-4997-861b-91e78711d4fc", // Replace with an image URL
        category: "Beverages",
        price: 5.00, // Adjust price as needed
      }

  ];

  const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createProducts() {
  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
  }

  console.log("Products created successfully!");
}

createProducts()
  .catch((e) => {
    console.error("Error creating products!", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
 //ngrok http --url=dear-civet-subtly.ngrok-free.app 80

  