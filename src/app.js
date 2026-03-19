console.log("🔥 ARRANCANDO APP PRO 🔥");

const express = require("express");
const cors = require("cors");
const pool = require("./db/connection");
const ExcelJS = require("exceljs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ======================
// 🔐 MIDDLEWARE AUTH
// ======================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).send("No autorizado");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send("Token inválido");
  }
}

// ======================
// 🌐 RUTA PRINCIPAL
// ======================
app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

// ======================
// 🧪 TEST DB
// ======================
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error en la DB");
  }
});

// ======================
// 👤 REGISTRO
// ======================
app.post("/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO usuarios (nombre, email, password) VALUES ($1,$2,$3) RETURNING *",
      [nombre, email, hashed]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al registrar");
  }
});

// ======================
// 🔑 LOGIN
// ======================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM usuarios WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).send("Usuario no existe");
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).send("Contraseña incorrecta");
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET
    );

    res.json({ token });

  } catch (error) {
    console.error(error);
    res.status(500).send("Error en login");
  }
});

// ======================
// 📦 CENTROS
// ======================
app.get("/centros", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM centros_costos ORDER BY nombre");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener centros");
  }
});

// ======================
// 📂 CATEGORIAS
// ======================
app.get("/categorias", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categorias ORDER BY nombre");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener categorias");
  }
});

// ======================
// ➕ CREAR EGRESO (PROTEGIDO)
// ======================
app.post("/egresos", auth, async (req, res) => {
  try {
    const {
      fecha,
      tipo,
      descripcion,
      monto,
      iva,
      numero_factura,
      comentarios,
      centro_costo_id,
      categoria_id
    } = req.body;

    const result = await pool.query(`
      INSERT INTO egresos 
      (fecha, tipo, descripcion, monto, iva, numero_factura, comentarios, centro_costo_id, categoria_id, usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `, [
      fecha,
      tipo,
      descripcion,
      monto,
      iva,
      numero_factura,
      comentarios,
      centro_costo_id,
      categoria_id,
      req.user.id
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al guardar egreso");
  }
});

// ======================
// 📋 LISTAR EGRESOS (POR USUARIO)
// ======================
app.get("/egresos", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.fecha,
        e.tipo,
        e.descripcion,
        e.monto,
        e.iva,
        e.numero_factura,
        e.comentarios,
        c.nombre AS centro_costo,
        cat.nombre AS categoria
      FROM egresos e
      LEFT JOIN centros_costos c ON e.centro_costo_id = c.id
      LEFT JOIN categorias cat ON e.categoria_id = cat.id
      WHERE e.usuario_id = $1
      ORDER BY e.fecha DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener egresos");
  }
});

// ======================
// 📊 FILTRO POR MES
// ======================
app.get("/egresos/mes", auth, async (req, res) => {
  try {
    const { mes, anio } = req.query;

    const result = await pool.query(`
      SELECT 
        e.fecha,
        e.descripcion,
        e.monto,
        c.nombre AS centro_costo,
        cat.nombre AS categoria
      FROM egresos e
      LEFT JOIN centros_costos c ON e.centro_costo_id = c.id
      LEFT JOIN categorias cat ON e.categoria_id = cat.id
      WHERE EXTRACT(MONTH FROM e.fecha) = $1
      AND EXTRACT(YEAR FROM e.fecha) = $2
      AND e.usuario_id = $3
      ORDER BY e.fecha DESC
    `, [mes, anio, req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al filtrar egresos");
  }
});

// ======================
// 📥 EXPORTAR EXCEL
// ======================
app.get("/egresos/excel", auth, async (req, res) => {
  try {
    const { mes, anio } = req.query;

    const result = await pool.query(`
      SELECT 
        e.fecha,
        e.tipo,
        e.descripcion,
        e.monto,
        e.iva,
        e.numero_factura,
        e.comentarios,
        c.nombre AS centro_costo,
        cat.nombre AS categoria
      FROM egresos e
      LEFT JOIN centros_costos c ON e.centro_costo_id = c.id
      LEFT JOIN categorias cat ON e.categoria_id = cat.id
      WHERE EXTRACT(MONTH FROM e.fecha) = $1
      AND EXTRACT(YEAR FROM e.fecha) = $2
      AND e.usuario_id = $3
      ORDER BY e.fecha DESC
    `, [mes, anio, req.user.id]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Egresos");

    worksheet.columns = [
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Tipo", key: "tipo", width: 15 },
      { header: "Descripción", key: "descripcion", width: 30 },
      { header: "Monto", key: "monto", width: 15 },
      { header: "Centro", key: "centro_costo", width: 20 },
      { header: "Categoría", key: "categoria", width: 20 }
    ];

    result.rows.forEach(e => worksheet.addRow(e));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=egresos.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar Excel");
  }
});

// ======================
// 🚀 SERVIDOR
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo 🚀");
});