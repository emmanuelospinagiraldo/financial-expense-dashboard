console.log("🔥 ARRANCANDO APP CORRECTA 🔥");
const express = require("express");
const cors = require("cors");
const pool = require("./db/connection");
const ExcelJS = require("exceljs");
const path = require("path"); // 👈 AQUÍ


const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

// Ruta principal
app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

// Test DB
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error en la DB");
  }
});

// ✅ POST EGRESOS (CORREGIDO)
app.post("/egresos", async (req, res) => {
    
  try {
    console.log("BODY:", req.body);
    
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

    const query = `
      INSERT INTO egresos 
      (fecha, tipo, descripcion, monto, iva, numero_factura, comentarios, centro_costo_id, categoria_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
        fecha,
        tipo,
        descripcion,
        monto,
        iva,
        numero_factura,
        comentarios,
        centro_costo_id,
        categoria_id
      ];      
    const result = await pool.query(query, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al guardar egreso");
  }
});

// GET todos
app.get("/egresos", async (req, res) => {
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
  LEFT JOIN centros_costos c
    ON e.centro_costo_id = c.id
  LEFT JOIN categorias cat
    ON e.categoria_id = cat.id
  ORDER BY e.fecha DESC
`);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener egresos");
  }
});
// GET por mes
app.get("/egresos/mes", async (req, res) => {
  try {
    const { mes, anio } = req.query;

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
      LEFT JOIN centros_costos c
        ON e.centro_costo_id = c.id
      LEFT JOIN categorias cat
        ON e.categoria_id = cat.id
      WHERE EXTRACT(MONTH FROM e.fecha) = $1
      AND EXTRACT(YEAR FROM e.fecha) = $2
      ORDER BY e.fecha DESC
    `, [mes, anio]);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al filtrar egresos");
  }
});

// EXCEL
app.get("/egresos/excel", async (req, res) => {
  try {
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
       LEFT JOIN centros_costos c
       ON e.centro_costo_id = c.id
       LEFT JOIN categorias cat
       ON e.categoria_id = cat.id
       WHERE EXTRACT(MONTH FROM e.fecha) = $1
       AND EXTRACT(YEAR FROM e.fecha) = $2
       ORDER BY e.fecha DESC
   `,    [mes, anio]);

    const egresos = result.rows;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Egresos");

    worksheet.columns = [
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Tipo", key: "tipo", width: 15 },
      { header: "Descripción", key: "descripcion", width: 30 },
      { header: "Monto", key: "monto", width: 15 },
      { header: "IVA", key: "iva", width: 10 },
      { header: "Factura", key: "numero_factura", width: 20 },
      { header: "Comentarios", key: "comentarios", width: 30 },
    ];

    egresos.forEach((egreso) => {
      worksheet.addRow(egreso);
    });

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

app.get("/centros", async (req, res) => {
  const result = await pool.query("SELECT * FROM centros_costos");
  res.json(result.rows);
});

app.get("/categorias", async (req, res) => {
  const result = await pool.query("SELECT * FROM categorias");
  res.json(result.rows);
});

// SERVIDOR
app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});