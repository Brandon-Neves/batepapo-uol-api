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
  if (error) return res.status(422).send('Insira um usuário válido')

  try {
    const userExist = await db.collection('participants').findOne({ name })
    if (userExist)
      return res.status(409).send('Usuário em uso, escolha outro username')

    await db
      .collection('participants')
      .insertOne({ name, lastStatus: Date.now() })

    await db.collection('messages').insertOne({
      from: { name },
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    })
    res.status(201)
  } catch (err) {
    res.status(500)
  }
})

app.get('/participants', async (req, res) => {
  try {
    const queryUsers = await db.collection('participants').find().toArray()
    if (!queryUsers) {
      return res.send([])
    }
    res.send(queryUsers)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

const messageSchema = joi.object({
  to: joi.string().required().min(3),
  text: joi.string().required().min(1),
  type: joi.string().required().valid('message', 'private_message')
})

app.post('/messages', async (req, res) => {
  const { to, text, type } = req.body
  const { user } = req.headers
  console.log(user)
  const { error } = messageSchema.validate({ to, text, type })
  if (error) return res.status(422)

  try {
    const fromExist = await db
      .collection('participants')
      .findOne({ name: user })
    if (!fromExist) return res.status(422)
    await db.collection('messages').insertOne({
      from: user,
      to,
      text,
      type,
      time: dayjs().format('HH:mm:ss')
    })
    res.status(201)
  } catch (err) {
    res.status(500)
  }
})

app.get('/messages', async (req, res) => {
  const messages = await db.collection('messages').find().toArray()
  res.send(messages)
})

const PORT = 5000

app.listen(PORT, () => console.log('Servidor funcionando'))
