import express from 'express'
import { MongoClient } from 'mongodb';
import 'dotenv/config'
import cors from 'cors'

const app = express()
const port = 5000

app.use(cors())
app.use(express.json())


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

const mongoClient = await connectToMongoDB()

// Database create
const db = mongoClient.db('social-dev-event')
const eventCollection = db.collection('event')


// home route
app.get('/', (req, res) => {
    res.send({message: 'Server is running fine!'})
})

// data create ( event create ( data ) )
app.post('/create-event', async(req, res) => {
    const data = req.body
    const result = await eventCollection.insertOne(data)

    console.log(result)
    res.send(result)
})

// data get kore front-end e niye ashbo 
app.get('/events', async(req, res) => {
    const result = await eventCollection.find().toArray()
    res.send(result) 
})



// http://localhost:5000/create-event

app.listen(port, () => {
    console.log(`Your Server is running on port ${port}`)
})