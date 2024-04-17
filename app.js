import express from "express";
import http from "http";
import { Server as socketIo } from "socket.io";
import amqp from "amqplib";
import chalk from "chalk";
import cors from "cors";
import mqtt from "mqtt";

const app = express();
const server = http.createServer(app);
const io = new socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"],
    optionsSuccessStatus: 204,
  },
});

const rabbitMQConfig = {
  protocol: "amqp",
  hostname: "18.209.192.241",
  port: 5672,
  username: "guest",
  password: "guest",
};
const queueName = "log";

// MQTT config
const mqttBrokerUrl = "mqtt://44.195.122.178";
const mqttTopic = "esp32/";

app.use(cors());

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  console.log(chalk.green("Cliente conectado"));
});

server.listen(3001, () => {
  console.log(chalk.yellow("Servidor Express escuchando en el puerto 3001"));
  connectToMQTT();
});

async function connectToMQTT() {
  try {
    const mqttClient = mqtt.connect(mqttBrokerUrl);

    mqttClient.on("connect", () => {
      console.log(chalk.green("Conectado a MQTT"));
      mqttClient.subscribe(mqttTopic);
    });

    mqttClient.on("message", async (topic, message) => {
      const msg = `${topic}: ${message}`;

      console.log(chalk.blue("Mensaje recibido de MQTT: ") + chalk.red(msg));

      // Send message to RabbitMQ
      await sendMessageToRabbitMQ(message.toString());

      // Emitir mensaje a los clientes conectados
      io.emit("mqttMessage", message.toString());
    });

  } catch (error) {
    console.error(chalk.red("Error al conectar a MQTT:"), error);
  }
}

async function sendMessageToRabbitMQ(message) {
  try {
    const connection = await amqp.connect(rabbitMQConfig);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);

    console.log(chalk.green("Conectado a RabbitMQ"));

    // Envía el mensaje a la cola de RabbitMQ
    await channel.sendToQueue(queueName, Buffer.from(message));

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error(chalk.red("Error al enviar mensaje a RabbitMQ:"), error);
  }
}
