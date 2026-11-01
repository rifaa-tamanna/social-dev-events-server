import express from 'express'
import { MongoClient } from 'mongodb';
import 'dotenv/config'

const app = express()
const port = 5000


const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

connectToMongoDB()

app.get('/', (req, res) => {
    res.send({message: 'Server is running fine!'})
})



// http://localhost:5000

app.listen(port, () => {
    console.log(`Your Server is running on port ${port}`)
})