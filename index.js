import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

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
    throw err;
  }
}

const mongoClient = await connectToMongoDB();

// Database
const db = mongoClient.db("social-dev-event");
const eventCollection = db.collection("event");
const joiningCollection = db.collection("joining");

// Verify Token
const verifyToken = async(req, res, next) => {
  const authHeader = req.headers.authorization;
  if(!authHeader) {
    return res.status(401).send({msg: 'Unauthorized'})
  }

  const token = authHeader.split(" ")[1]
  if(!token) {
    return res.status(401).send({msg: 'Unauthorized'})
  }

  const JWKS = createRemoteJWKSet (
    new URL('http://localhost:3000/api/auth/jwks')
  )

  try {
    const {payload} = await jwtVerify(token, JWKS)
    next();
  } catch (error) {
    return res.status(401).send({msg: 'Server Error'})
  }
  
};

// Home Route
app.get("/", (req, res) => {
  res.send({ message: "Server is running fine!" });
});

// Create Event
app.post("/create-event", async (req, res) => {
  try {
    const data = req.body;

    if (!data.organizerEmail) {
      return res.status(400).send({
        success: false,
        message: "Organizer email is required!",
      });
    }

    // Validate event date format (YYYY-MM-DD)
    const eventDate = data.date;

    if (
      typeof eventDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    ) {
      return res.status(400).send({
        success: false,
        message: "Please provide a valid event date.",
      });
    }

    // Check whether the date is a real calendar date
    const parsedDate = new Date(`${eventDate}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== eventDate
    ) {
      return res.status(400).send({
        success: false,
        message: "Invalid event date.",
      });
    }

    // Get today's date according to Bangladesh time
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    // Reject past dates
    if (eventDate < today) {
      return res.status(400).send({
        success: false,
        message:
          "Past event dates are not allowed. Select today or a future date.",
      });
    }

    const result = await eventCollection.insertOne({
      ...data,
      organizerEmail: data.organizerEmail,
      createdAt: new Date(),
    });

    res.status(201).send({
      success: true,
      message: "Event created successfully!",
      result,
    });
  } catch (error) {
    console.error("Create Event Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to create event",
    });
  }
});

// Get 6 Most Recently Created Upcoming Events
app.get("/recent-upcoming-events", async (req, res) => {
  try {
    // Get today's date according to Bangladesh time
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const result = await eventCollection
      .find({
        date: { $gte: today },
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.send(result);
  } catch (error) {
    console.error("Recent Upcoming Events Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch recent upcoming events",
    });
  }
});

// Get All Events
app.get("/events", async (req, res) => {
  try {
    const result = await eventCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Get Events Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch events",
    });
  }
});

// Get Single Event Details
app.get(
  "/events/:id",

  verifyToken,

  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          success: false,
          message: "Invalid event ID",
        });
      }

      const result = await eventCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!result) {
        return res.status(404).send({
          success: false,
          message: "Event not found",
        });
      }

      res.send(result);
    } catch (error) {
      console.error("Single Event Error:", error);

      res.status(500).send({
        success: false,
        message: "Failed to fetch event details",
      });
    }
  },
);

// Join Event
app.post("/joining", async (req, res) => {
  try {
    const data = req.body;

    // Remove existing event _id
    const { _id, ...joiningData } = data;

    // Validate required data
    if (!_id || !joiningData.email) {
      return res.status(400).send({
        success: false,
        message: "Event ID and user email are required",
      });
    }

    // Insert joining data
    const result = await joiningCollection.insertOne({
      ...joiningData,
      eventId: _id,
      joinedAt: new Date(),
    });

    res.status(201).send({
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

// Leave Event
app.delete("/joining", async (req, res) => {
  try {
    const { eventId, email } = req.body;

    if (!eventId || !email) {
      return res.status(400).send({
        success: false,
        message: "Event ID and email are required",
      });
    }

    const result = await joiningCollection.deleteOne({
      eventId,
      email,
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

// Get My Joined Events
app.get("/my-joined-events/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // Find all events joined by this user
    const joinedData = await joiningCollection.find({ email }).toArray();

    // Get event IDs
    const eventIds = joinedData
      .filter((item) => ObjectId.isValid(item.eventId))
      .map((item) => new ObjectId(item.eventId));

    // Find original events
    const events = await eventCollection
      .find({ _id: { $in: eventIds } })
      .toArray();

    // Match joining data with event data
    const eventMap = new Map(
      events.map((event) => [event._id.toString(), event]),
    );

    const result = joinedData.map((join) => ({
      ...(eventMap.get(join.eventId) || join),
      joiningId: join._id.toString(),
      eventId: join.eventId,
      joinedAt: join.joinedAt,
    }));

    res.send({
      success: true,
      result,
    });
  } catch (error) {
    console.error("My Joined Events Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch joined events",
    });
  }
});

// Get My Created Events
app.get("/my-events/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await eventCollection
      .find({ organizerEmail: email })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error("My Events Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch my events",
    });
  }
});

//Patch Event
app.patch("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { organizerEmail, ...updatedData } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid event ID" });
    }

    if (!organizerEmail) {
      return res.status(400).send({ message: "Organizer email is required" });
    }

    const allowedFields = [
      "title",
      "type",
      "date",
      "location",
      "thumbnail",
      "description",
    ];

    const updateFields = {};

    for (const field of allowedFields) {
      if (typeof updatedData[field] === "string") {
        updateFields[field] = updatedData[field].trim();
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).send({ message: "No valid data to update" });
    }

    const result = await eventCollection.updateOne(
      {
        _id: new ObjectId(id),
        organizerEmail,
      },
      {
        $set: updateFields,
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Event not found or unauthorized",
      });
    }

    res.send({
      success: true,
      message: "Event updated successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to update event",
    });
  }
});

// Delete Event
app.delete("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { organizerEmail } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid event ID" });
    }

    if (!organizerEmail) {
      return res.status(400).send({
        message: "Organizer email is required",
      });
    }

    const result = await eventCollection.deleteOne({
      _id: new ObjectId(id),
      organizerEmail,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Event not found or unauthorized",
      });
    }

    // Remove associated joining records
    await joiningCollection.deleteMany({
      eventId: id,
    });

    res.send({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete event",
    });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Your Server is running on port ${port}`);
});

export default app;
