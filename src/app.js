import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { MongoClient, ObjectId } from 'mongodb'
import joi from 'joi'
import dayjs from 'dayjs'

dotenv.config()
const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db

const usersSchema = joi.object({
  name: joi.string().required().min(3)
})

try {
  await mongoClient.connect()
  db = mongoClient.db()
} catch (err) {
  console.log(err.message)
}

const app = express()
app.use(cors())
app.use(express.json())

app.post('/participants', async (req, res) => {
  const { name } = req.body
  const { error } = usersSchema.validate({ name })
  if (error) return res.sendStatus(422)

  try {
    const userExist = await db.collection('participants').findOne({ name })
    if (userExist) return res.sendStatus(409)

    await db
      .collection('participants')
      .insertOne({ name, lastStatus: Date.now() })

    await db.collection('messages').insertOne({
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    })
    res.sendStatus(201)
  } catch (err) {
    res.sendStatus(500)
  }
})

app.get('/participants', async (req, res) => {
  try {
    const queryUsers = await db.collection('participants').find().toArray()
    if (!queryUsers) {
      return res.sendStatus([])
    }
    res.send(queryUsers)
  } catch (err) {
    res.sendStatus(500)
  }
})

const messageSchema = joi.object({
  from: joi.string().required(),
  to: joi.string().required().min(3),
  text: joi.string().required().min(1),
  type: joi.string().required().valid('message', 'private_message')
})

app.post('/messages', async (req, res) => {
  const { to, text, type } = req.body
  const { user } = req.headers
  const { error, value } = messageSchema.validate(
    { to, text, type, from: user },
    { abortEarly: false }
  )
  if (error) return res.sendStatus(422)

  try {
    const fromExist = await db
      .collection('participants')
      .findOne({ name: user })
    if (!fromExist) return res.sendStatus(422)

    await db.collection('messages').insertOne({
      from: user,
      to: value.to,
      text: value.text,
      type: value.type,
      time: dayjs().format('HH:mm:ss')
    })
    res.sendStatus(201)
  } catch (err) {
    res.sendStatus(500)
  }
})

app.get('/messages', async (req, res) => {
  const { user } = req.headers
  const limit = req.query.limit

  if (parseInt(limit) <= 0 || (isNaN(limit) && limit))
    return res.sendStatus(422)

  try {
    const messages = await db
      .collection('messages')
      .find({
        $or: [
          { from: user },
          { to: { $in: [user, 'Todos'] } },
          { type: 'message' }
        ]
      })
      .limit(Number(limit))
      .toArray()
    res.send(messages)
  } catch (err) {
    res.sendStatus(500)
  }
})

app.post('/status', async (req, res) => {
  const { user } = req.headers

  if (!user) return res.sendStatus(404)

  try {
    const userExist = await db
      .collection('participants')
      .findOne({ name: user })
    if (!userExist) return res.sendStatus(404)
    await db
      .collection('participants')
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
    res.sendStatus(200)
  } catch (err) {
    res.status(500)
  }
})

setInterval(async () => {
  const seconds = Date.now() - 10000

  try {
    const participants = await db
      .collection('participants')
      .find({ lastStatus: { $lte: seconds } })
      .toArray()
    if (participants.length > 0) {
      const newMessages = participants.map(p => {
        return {
          from: p.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs().format('HH:ss:mm')
        }
      })
      await db.collection('messages').insertMany(newMessages)
      await db
        .collection('participants')
        .deleteMany({ lastStatus: { $lte: seconds } })
    }
  } catch (err) {
    console.log(err)
  }
}, 15000)

const PORT = 5000

app.listen(PORT, () => console.log('Servidor funcionando'))
