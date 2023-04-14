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

app.post('/users', async (req, res) => {
  const { name } = req.body
  const { error } = usersSchema.validate({ name })
  if (error) return res.status(422).send('Insira um usuário válido')

  try {
    const userExist = await db.collection('users').findOne({ name })
    if (userExist)
      return res.status(409).send('Usuário em uso, escolha outro username')

    await db.collection('users').insertOne({ name, lastStatus: Date.now() })
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

app.get('/users', async (req, res) => {
  try {
    const queryUsers = await db.collection('users').find().toArray()
    if (!queryUsers) {
      return res.send([])
    }
    res.send(queryUsers)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

const PORT = 5000

app.listen(PORT, () => console.log('Servidor funcionando'))
