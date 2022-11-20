const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

require('dotenv').config()
// middlewire
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.rat3bcl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function VerifyJWT(req, res , next) {
    const authHeader = req.headers.authorization;
    if(!authHeader) {
        return res.status(401).send('Unauthorized access');
    }
    const token = authHeader.split(' ')[1]
 

    jwt.verify(token , process.env.JSON_PRIVATE_KEY ,function(err , decoded) {
    
        if(err) {
            return res.status(403).send('Forbidden access')
        }
        req.decoded = decoded
        next()
    })
    
} 

async function run() {
    try {
        const appoinmets = client.db("DoctorsPortal").collection("appoinmetsOptions")
        const bookingsDB = client.db("DoctorsPortal").collection("bookings")
        const usersDB = client.db("DoctorsPortal").collection("usersDB")
        const doctorsDB = client.db("DoctorsPortal").collection("doctorsDB")

        const verifyAdmin = async(req , res , next) => {
            const decodedEmail = req.decoded.email;
            const query = {email : decodedEmail}
            const user = await usersDB.findOne(query)
            if(user.role !== 'admin') {
                return  res.status(403).send({message : 'unathorized access'})
            }
          next()
        }


        app.get('/appoinmentsOptions', async (req, res) => {
            const date = req.query.date;
            const query = {}
            const appoinmentsOptions = await appoinmets.find(query).toArray()
             // get the bookings of the provided date
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsDB.find(bookingQuery).toArray()
            //    code carefully 
            appoinmentsOptions.forEach(option => {
                const optionsBooked = alreadyBooked.filter(options => options.treatment === option.name)
                const bookedSlots = optionsBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots
                // option.slots(remainingSlots)
            })
            res.send(appoinmentsOptions)
        })
        // bookins and myAppoinments are same route 
        app.post('/bookings',  async (req, res) => {
            const bookings = req.body
            const query = {
                appointmentDate  : bookings.appointmentDate , 
                email : bookings.email , 
                treatment : bookings.treatment
            }
           
            const alreadyBooked = await bookingsDB.find(query).toArray()
        
            if(alreadyBooked.length) {
                const message = `You already have booking on ${bookings.appointmentDate}`
                return res.send({acknowledged : false, message})
            }
   
            const result = await bookingsDB.insertOne(bookings)
            res.send(result)
        })
        // bookins and myAppoinments are same route 

        app.get('/myAppoinmets' , VerifyJWT ,async (req , res)  => {
            const email = req.query.email;
            const decodedMail = req.decoded.email;
            
            if(decodedMail !== email) {
                     return res.status(403).send({message : "forbidden access"})
            }
            const query = {
                email : email
            }
            const result = await bookingsDB.find(query).toArray();
            res.send(result)
        })
       
        app.get('/appointmentsOptions' , async (req , res) => {
            const query = {}
            const result = await appoinmets.find(query).project({name:1}).toArray()
            res.send(result)
        })
        app.get('/jwt' , async (req , res) => {
            const email = req.query.email;
            const query = {email : email}
            const user = await usersDB.findOne(query)
            if(user) {
                const token = jwt.sign({email} , process.env.JSON_PRIVATE_KEY ,
                    //  {expiresIn : '1hr'}
                     )

                return   res.send({accessToken :token})
            }
            res.status(403).send({accessToken : ''})
        })
        app.post('/users' , async (req , res) => {
            const user = req.body;
          
            const result  = await usersDB.insertOne(user)
            res.send(result);
        })

        app.get('/users' , async (req, res) => {
            const query = {}
            const users = await usersDB.find(query).toArray();
            res.send(users)
        })

        app.put('/users/admin/:id' , VerifyJWT ,verifyAdmin,  async (req , res) => {
            
            
            const id=req.params.id
            const filter = { _id: ObjectId(id)}
            const options = {upsert : true}
            const updateDoc = {
                $set : {
                    role : 'admin'
                }
            }
            const result = await usersDB.updateOne(filter,updateDoc,options)
            res.send(result)
        })
        
        app.get('/addPrice' ,async(req , res ) => {
            const filter = {}
            const options = {upsert : true}
            const updatedDoc = {
                $set : {
                    price : 99
                }
            }
            const result = await appoinmets.insertMany(filter, updatedDoc, options)
            // const result = 'hello'
            res.send(result)
        })
        app.get('/users/admin/:email' , async (req , res) => {
            const email = req.params.email;
            const query = {email};
            const user = await usersDB.findOne(query)
            res.send({isAdmin : user?.role === 'admin'})
        })
        app.get('/doctors' , async (req , res) => {
            const query = {}
            const doctors = await doctorsDB.find(query).toArray()
            res.send(doctors)
        })
        app.post('/doctors' ,VerifyJWT ,verifyAdmin , async (req , res) => {
            const doctorInfo = req.body;
            const result =await doctorsDB.insertOne(doctorInfo)
            res.send(result)
        })
        app.delete('/doctors/:id' ,VerifyJWT,verifyAdmin , async (req ,res ) => {
            const userId = req.params.id ;
            const query = {_id: ObjectId(userId)}
            const result =await doctorsDB.deleteOne(query)
            res.send(result)
        })
    }
    catch {

    }
}

run()
app.get('/', (req, res) => {
    res.send('Server Side')
})

app.listen(port, () => {
    console.log(`Running app on Port  ${port}`)
})