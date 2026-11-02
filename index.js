import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

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

const mongoClient = await connectToMongoDB();

// Database create
const db = mongoClient.db("social-dev-event");
const eventCollection = db.collection("event");
const joiningCollection = db.collection("joining");

// home route
app.get("/", (req, res) => {
  res.send({ message: "Server is running fine!" });
});

// data create ( event create ( data ) )
app.post("/create-event", async (req, res) => {
  const data = req.body;
  const result = await eventCollection.insertOne(data);

  console.log(result);
  res.send(result);
});

// data get kore front-end e niye ashbo
app.get("/events", async (req, res) => {
  const result = await eventCollection.find().toArray();
  res.send(result);
});

// single date details
app.get("/events/:id", async (req, res) => {
  const { id } = req.params;
  const result = await eventCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

// joining data insert
app.post("/joining", async (req, res) => {
  try {
    const data = req.body;

    // Remove the existing event _id
    const { _id, ...joiningData } = data;

    const result = await joiningCollection.insertOne({
      ...joiningData,
      eventId: _id,
      joinedAt: new Date(),
    });

    res.send({
      success: true,
      message: "Successfully joined the event",
      result,
    });
  } catch (error) {
    console.error("Joining Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to join event",
      error: error.message,
    });
  }
});

// joining event theke leave API
app.delete("/joining", async (req, res) => {
  try {
    const { eventId, email } = req.body;

    const result = await joiningCollection.deleteOne({
      eventId: eventId,
      email: email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "You have not joined this event!",
      });
    }

    res.send({
      success: true,
      message: "Successfully left the event!",
    });
  } catch (error) {
    console.error("Leave Event Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to leave event",
    });
  }
});

// My Create Event or Manage Event
app.get('/my-events/:email', async(req, res) => {
    const {email} = req.params
    const result = await eventCollection.find({ organizerEmail:email }).toArray()
    res.send(result)
})








// http://localhost:5000/my-events/

app.listen(port, () => {
  console.log(`Your Server is running on port ${port}`);
});
