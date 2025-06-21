const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Database configuration
const pool = new Pool({
  connectionString: process.env.DB_URL || 'postgres://username:password@localhost:5432/report_db',
  ssl: {
    rejectUnauthorized: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Error handling middleware
const handleError = (res, error, message = 'Internal server error') => {
  console.error(error);
  res.status(500).json({ error: message });
};

// Database connection test
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// Routes

app.get('/', (req, res) => {
  res.json({ message: 'Report API is active', author: "Fitran Alfian Nizar" });
})
// Get all schools
app.get('/api/school-list', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schools ORDER BY satuan_pendidikan');
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching schools');
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT nip, name, npsn FROM users WHERE nip = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'Error fetching user');
  }
});

// Get user's school data
app.get('/api/user/:id/school-data', async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query('SELECT npsn FROM users WHERE nip = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const schoolResult = await pool.query('SELECT * FROM schools WHERE npsn = $1', [userResult.rows[0].npsn]);
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json(schoolResult.rows[0]);
  } catch (error) {
    handleError(res, error, 'Error fetching school data');
  }
});

// Change user's school
app.post('/api/users/:id/change-school', async (req, res) => {
  try {
    const { id } = req.params;
    const { npsn } = req.body;

    const result = await pool.query(
      'UPDATE users SET npsn = $1, updated_at = CURRENT_TIMESTAMP WHERE nip = $2 RETURNING nip, name, npsn',
      [npsn, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'Error updating user school');
  }
});

// Update user profile
app.post('/api/users/:id/update-user', async (req, res) => {
  try {
    const { id } = req.params;
    const { nip, name } = req.body;

    await pool.query(
      'UPDATE users SET nip = $1, name = $2, updated_at = CURRENT_TIMESTAMP WHERE nip = $3',
      [nip, name, id]
    );

    res.json({ status: 200 });
  } catch (error) {
    handleError(res, error, 'Error updating user profile');
  }
});

// Add new school
app.post('/api/schools/add-school', async (req, res) => {
  try {
    const {
      npsn,
      dinas_pendidikan,
      satuan_pendidikan,
      alamat,
      desa,
      kecamatan,
      kabupaten,
      provinsi,
      kode_pos,
      website,
      email,
      telp,
      kepala_sekolah,
      nip_kepala_sekolah
    } = req.body;

    // Check if school already exists
    const existing = await pool.query('SELECT npsn FROM schools WHERE npsn = $1', [npsn]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'School already exists' });
    }

    await pool.query(
      `INSERT INTO schools (
        npsn, dinas_pendidikan, satuan_pendidikan, alamat, desa, kecamatan, kabupaten, provinsi, kode_pos, website, email, telp, kepala_sekolah, nip_kepala_sekolah
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        npsn,
        dinas_pendidikan,
        satuan_pendidikan,
        alamat,
        desa,
        kecamatan,
        kabupaten,
        provinsi,
        kode_pos,
        website,
        email,
        telp,
        kepala_sekolah,
        nip_kepala_sekolah
      ]
    );

    res.json({ status: 200 });
  } catch (error) {
    handleError(res, error, 'Error adding new school');
  }
});

// Update school profile
app.post('/api/schools/:id/update-school', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dinas_pendidikan, satuan_pendidikan, alamat, desa, kecamatan,
      kabupaten, provinsi, kode_pos, website, email, telp, kepala_sekolah, nip_kepala_sekolah
    } = req.body;

    await pool.query(`
      UPDATE schools SET 
        dinas_pendidikan = $1, satuan_pendidikan = $2, alamat = $3, desa = $4,
        kecamatan = $5, kabupaten = $6, provinsi = $7, kode_pos = $8,
        website = $9, email = $10, telp = $11, kepala_sekolah = $12, nip_kepala_sekolah = $13, updated_at = CURRENT_TIMESTAMP
      WHERE npsn = $14
    `, [dinas_pendidikan, satuan_pendidikan, alamat, desa, kecamatan, kabupaten, provinsi, kode_pos, website, email, telp, kepala_sekolah, nip_kepala_sekolah, id]);

    res.json({ status: 200 });
  } catch (error) {
    handleError(res, error, 'Error updating school profile');
  }
});

// Get user's reports
app.get('/api/users/:user_id/reports/', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query('SELECT * FROM reports WHERE nip = $1 ORDER BY updated_at DESC', [user_id]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching user reports');
  }
});

// Create or update report
app.post('/api/users/:nip/reports', async (req, res) => {
  try {
    const { nip } = req.params;
    const { report_data } = req.body;

    if (!report_data.report_id) {
      // Create new report
      const reportId = uuidv4();
      await pool.query(`
        INSERT INTO reports (report_id, nip, school_year, semester, class, phase, deadline)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [reportId, nip, report_data.school_year, report_data.semester, report_data.class, report_data.phase, report_data.deadline]);
    } else {
      // Update existing report
      const result = await pool.query(`
        UPDATE reports SET 
          school_year = $1, semester = $2, class = $3, phase = $5, deadline = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE report_id = $4
      `, [report_data.school_year, report_data.semester, report_data.class, report_data.report_id, report_data.phase, report_data.deadline]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }
    }

    res.json({ status: 200 });
  } catch (error) {
    handleError(res, error, 'Error saving report');
  }
});

// Get report by ID
app.get('/api/reports/:report_id', async (req, res) => {
  try {
    const { report_id } = req.params;
    const result = await pool.query('SELECT * FROM reports WHERE report_id = $1', [report_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'Error fetching report');
  }
});

// Get students by report ID
app.get('/api/reports/:report_id/students', async (req, res) => {
  try {
    const { report_id } = req.params;
    const result = await pool.query('SELECT * FROM students WHERE report_id = $1 ORDER BY name', [report_id]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching students');
  }
});

// Get subjects by report ID
app.get('/api/reports/:report_id/subjects', async (req, res) => {
  try {
    const { report_id } = req.params;
    const result = await pool.query('SELECT * FROM subjects WHERE report_id = $1 ORDER BY subject_name', [report_id]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching subjects');
  }
});

// Get CP by subject ID
app.get('/api/subjects/:subject_id/cp', async (req, res) => {
  try {
    const { subject_id } = req.params;
    const result = await pool.query('SELECT * FROM cps WHERE subject_id = $1 ORDER BY cp_num', [subject_id]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching CPs');
  }
});

// Create or update CPs
app.post('/api/subjects/:subject_id/cp', async (req, res) => {
  try {
    const { subject_id } = req.params;
    const { cp_data } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get existing CPs for this subject
      const existingCPs = await client.query('SELECT cp_id FROM cps WHERE subject_id = $1', [subject_id]);
      const existingCPIds = existingCPs.rows.map(row => row.cp_id);

      // Collect all cp_ids that will remain after this operation
      const keptCPIds = [];

      // Process each CP
      for (const cp of cp_data) {
        if (cp.cp_id && existingCPIds.includes(cp.cp_id)) {
          // Update existing CP
          console.log(`Updating CP: ${cp.cp_id}`);
          await client.query(
            'UPDATE cps SET cp_num = $1, cp_desc = $2, updated_at = CURRENT_TIMESTAMP WHERE cp_id = $3',
            [cp.cp_num, cp.cp_desc, cp.cp_id]
          );
          keptCPIds.push(cp.cp_id);
        } else {
          // Insert new CP
          console.log(`Inserting new CP for subject ${subject_id}`);
          const newCpId = uuidv4();
          await client.query(
            'INSERT INTO cps (cp_id, subject_id, cp_num, cp_desc) VALUES ($1, $2, $3, $4)',
            [newCpId, subject_id, cp.cp_num, cp.cp_desc]
          );
          keptCPIds.push(newCpId);
        }
      }

      // Delete CPs that are no longer in the data
      if (keptCPIds.length > 0) {
        await client.query(
          'DELETE FROM cps WHERE subject_id = $1 AND cp_id NOT IN (' + keptCPIds.map((_, i) => `$${i + 2}`).join(',') + ')',
          [subject_id, ...keptCPIds]
        );
      } else {
        await client.query('DELETE FROM cps WHERE subject_id = $1', [subject_id]);
      }

      await client.query('COMMIT');
      res.json({ status: 200 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(res, error, 'Error updating CPs');
  }
});

// Delete subject
app.delete('/api/subjects/:subject_id', async (req, res) => {
  try {
    const { subject_id } = req.params;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete related CPs (will cascade)
      await client.query('DELETE FROM cps WHERE subject_id = $1', [subject_id]);

      // Delete subject
      await client.query('DELETE FROM subjects WHERE subject_id = $1', [subject_id]);

      await client.query('COMMIT');
      res.json({ status: 200 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(res, error, 'Error deleting subject');
  }
});

// Create or update subject
app.post('/api/reports/:report_id/subjects', async (req, res) => {
  try {
    const { report_id } = req.params;
    const { subject } = req.body;
    const existingSubject = await pool.query('SELECT subject_id FROM subjects WHERE subject_id = $1', [subject.subject_id]);
    if (subject.subject_id && existingSubject.rows.length > 0) {
      // Update existing subject
      await pool.query(
        'UPDATE subjects SET subject_name = $1, subject_category = $2, min_mark = $3, updated_at = CURRENT_TIMESTAMP WHERE subject_id = $4',
        [subject.subject_name, subject.subject_category, subject.min_mark, subject.subject_id]
      );
    } else if (subject.subject_id) {
      // Insert new subject
      await pool.query(
        'INSERT INTO subjects (subject_id, report_id, subject_name, subject_category, min_mark) VALUES ($1, $2, $3, $4, $5)',
        [subject.subject_id, report_id, subject.subject_name, subject.subject_category, subject.min_mark]
      );
    }
    else {
      // Create new subject with a new ID
      const newSubjectId = uuidv4();
      await pool.query(
        'INSERT INTO subjects (subject_id, report_id, subject_name, subject_category, min_mark) VALUES ($1, $2, $3, $4, $5)',
        [newSubjectId, report_id, subject.subject_name, subject.subject_category, subject.min_mark]
      );
    }

    res.json({ status: 200 });
  } catch (error) {
    handleError(res, error, 'Error saving subject');
  }
});

// Create or update extras
app.post('/api/extras', async (req, res) => {
  try {
    const { extras_data } = req.body;

    if (extras_data.length === 0) {
      return res.json({ status: 200 });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const reportId = extras_data[0].report_id;
      const keptExtraIds = [];

      // Get existing extras for this report
      const existingExtras = await client.query('SELECT extra_id FROM extras WHERE report_id = $1', [reportId]);
      const existingExtraIds = existingExtras.rows.map(row => row.extra_id);

      // Process each extra
      for (const extra of extras_data) {
        if (extra.extra_id && existingExtraIds.includes(extra.extra_id)) {
          // Update existing extra
          await client.query(
            'UPDATE extras SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE extra_id = $2',
            [extra.name, extra.extra_id]
          );
          keptExtraIds.push(extra.extra_id);

        } else {
          // Insert new extra
          const extraId = extra.extra_id || uuidv4();
          await client.query(
            'INSERT INTO extras (extra_id, report_id, name) VALUES ($1, $2, $3)',
            [extraId, extra.report_id, extra.name]
          );
          keptExtraIds.push(extra.extra_id);

        }
      }

      // Delete extras that are no longer in the data
      if (keptExtraIds.length > 0) {
        await client.query(
          'DELETE FROM extras WHERE report_id = $1 AND extra_id NOT IN (' + keptExtraIds.map((_, i) => `$${i + 2}`).join(',') + ')',
          [reportId, ...keptExtraIds]
        );
      }

      await client.query('COMMIT');
      res.json({ status: 200 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(res, error, 'Error updating extras');
  }
});

// Get extras by report ID
app.get('/api/reports/:report_id/extras', async (req, res) => {
  try {
    const { report_id } = req.params;
    const result = await pool.query('SELECT * FROM extras WHERE report_id = $1 ORDER BY name', [report_id]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching extras');
  }
});

// Get extra marks by extra ID
app.get('/api/extras/:extra_id/extra-marks', async (req, res) => {
  try {
    const { extra_id } = req.params;
    const result = await pool.query('SELECT * FROM extra_marks WHERE extra_id = $1', [extra_id]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching extra marks');
  }
});

// Create or update extra marks
app.post('/api/extra-marks', async (req, res) => {
  try {
    const { extra_marks_data } = req.body;

    if (extra_marks_data.length === 0) {
      return res.json({ status: 200 });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const extraId = extra_marks_data[0].extra_id;

      // Get existing extra marks for this extra
      const existingMarks = await client.query('SELECT extra_mark_id FROM extra_marks WHERE extra_id = $1', [extraId]);
      const existingMarkIds = existingMarks.rows.map(row => row.extra_mark_id);

      // Track all mark IDs to keep
      const keptMarkIds = [];

      // Process each extra mark
      for (const mark of extra_marks_data) {
        console.log(mark.extra_id)
        if ((mark.extra_id && existingMarkIds.includes(mark.extra_mark_id)) || (keptMarkIds.includes(mark.extra_mark_id))) {
          // Update existing mark
          await client.query(
            'UPDATE extra_marks SET value = $1, description = $2, recommendation = $3, updated_at = CURRENT_TIMESTAMP WHERE extra_mark_id = $4',
            [mark.value, mark.description, mark.recommendation, mark.extra_mark_id]
          );
          keptMarkIds.push(mark.extra_mark_id);
        } else {
          // Insert new mark
          await client.query(
            'INSERT INTO extra_marks (extra_mark_id, extra_id, student_id, value, description, recommendation) VALUES ($1, $2, $3, $4, $5, $6)',
            [mark.extra_mark_id, mark.extra_id, mark.student_id, mark.value, mark.description, mark.recommendation]
          );
          keptMarkIds.push(mark.extra_mark_id);
        }
      }

      // Delete marks that are no longer in the data
      if (keptMarkIds.length > 0) {
        await client.query(
          'DELETE FROM extra_marks WHERE extra_id = $1 AND extra_mark_id NOT IN (' + keptMarkIds.map((_, i) => `$${i + 2}`).join(',') + ')',
          [extraId, ...keptMarkIds]
        );
      } else {
        await client.query('DELETE FROM extra_marks WHERE extra_id = $1', [extraId]);
      }

      await client.query('COMMIT');
      res.json({ status: 200 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(res, error, 'Error updating extra marks');
  }
});
// Get extra marks by multiple extra IDs
app.post('/api/extras/extra-marks', async (req, res) => {
  try {
    const { extra_ids } = req.body;

    if (extra_ids.length === 0) {
      return res.json({ extra_marks: [] });
    }

    const placeholders = extra_ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `SELECT * FROM extra_marks WHERE extra_id IN (${placeholders})`,
      extra_ids
    );

    res.json({ extra_marks: result.rows });
  } catch (error) {
    handleError(res, error, 'Error fetching extra marks');
  }
});


// Create or update students
app.post('/api/reports/:report_id/students', async (req, res) => {
  try {
    const { report_id } = req.params;
    const { students_data } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get existing students for this report
      const existingStudents = await client.query('SELECT student_id, nisn FROM students WHERE report_id = $1', [report_id]);
      const existingStudentMap = new Map(existingStudents.rows.map(row => [row.nisn, row.student_id]));

      // Process each student
      for (const student of students_data) {
        if (existingStudentMap.has(student.nisn)) {
          // Update existing student
          await client.query(`
            UPDATE students SET 
              name = $1, nis = $2, birthday = $3, gender = $4, religion = $5, prev_edu = $6, address = $7,
              father_name = $8, father_job = $9, mother_name = $10, mother_job = $11, parent_address = $12,
              village = $13, sub_dis = $14, regen = $15, prov = $16, guardian_name = $17, guardian_job = $18,
              guardian_address = $19, phone_num = $20, updated_at = CURRENT_TIMESTAMP
            WHERE nisn = $21 AND report_id = $22
          `, [
            student.name, student.nis, student.birthday, student.gender, student.religion, student.prev_edu, student.address,
            student.father_name, student.father_job, student.mother_name, student.mother_job, student.parent_address,
            student.village, student.sub_dis, student.regen, student.prov, student.guardian_name, student.guardian_job,
            student.guardian_address, student.phone_num, student.nisn, report_id
          ]);
        } else {
          // Insert new student
          const studentId = uuidv4();
          await client.query(`
            INSERT INTO students (
              student_id, name, nis, nisn, birthday, gender, religion, prev_edu, address,
              father_name, father_job, mother_name, mother_job, parent_address, village, sub_dis, regen, prov,
              guardian_name, guardian_job, guardian_address, phone_num, report_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15, $16, $17, $18,
              $19, $20, $21, $22, $23
            )
          `, [
            studentId, student.name, student.nis, student.nisn, student.birthday, student.gender, student.religion, student.prev_edu, student.address,
            student.father_name, student.father_job, student.mother_name, student.mother_job, student.parent_address, student.village, student.sub_dis, student.regen, student.prov,
            student.guardian_name, student.guardian_job, student.guardian_address, student.phone_num, report_id
          ]);
        }
      }

      // Delete students that are no longer in the data
      const newNisns = students_data.map(s => s.nisn);
      if (newNisns.length > 0) {
        await client.query(
          'DELETE FROM students WHERE report_id = $1 AND nisn NOT IN (' + newNisns.map((_, i) => `$${i + 2}`).join(',') + ')',
          [report_id, ...newNisns]
        );
      } else {
        await client.query('DELETE FROM students WHERE report_id = $1', [report_id]);
      }

      await client.query('COMMIT');
      res.json({ status: 200 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(res, error, 'Error updating students');
  }
});

//

// Get CPs by multiple subject IDs
app.post('/api/subjects/cps', async (req, res) => {
  try {
    const { subject_ids } = req.body;

    if (subject_ids.length === 0) {
      return res.json({ cp: [] });
    }

    const placeholders = subject_ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `SELECT * FROM cps WHERE subject_id IN (${placeholders}) ORDER BY subject_id, cp_num`,
      subject_ids
    );

    res.json({ cp: result.rows });
  } catch (error) {
    handleError(res, error, 'Error fetching CPs');
  }
});

// Get subject marks by multiple subject IDs
app.post('/api/subjects/get-marks', async (req, res) => {
  try {
    const { subject_ids } = req.body;

    if (subject_ids.length === 0) {
      return res.json({ subject_marks: [] });
    }

    const placeholders = subject_ids.map((_, i) => `$${i + 1}`).join(',');

    // Get all marks for the subjects
    const marksResult = await pool.query(`
      SELECT sm.*, c.cp_num 
      FROM subject_marks sm 
      LEFT JOIN cps c ON sm.cp_id = c.cp_id 
      WHERE sm.subject_id IN (${placeholders})
      ORDER BY sm.subject_id, sm.student_id
    `, subject_ids);

    // Group marks by subject_id and student_id
    const groupedMarks = {};

    marksResult.rows.forEach(mark => {
      const key = `${mark.subject_id}-${mark.student_id}`;
      if (!groupedMarks[key]) {
        groupedMarks[key] = {
          subject_id: mark.subject_id,
          student_id: mark.student_id,
          cp_marks: [],
          other_marks: []
        };
      }

      if (mark.cp_id) {
        groupedMarks[key].cp_marks.push({
          mark_id: mark.mark_id,
          value: mark.value,
          cp_id: mark.cp_id,
          cp_num: mark.cp_num,
          student_id: mark.student_id,
          subject_id: mark.subject_id
        });
      } else {
        groupedMarks[key].other_marks.push({
          mark_id: mark.mark_id,
          type: mark.type,
          value: mark.value,
          student_id: mark.student_id,
          subject_id: mark.subject_id
        });
      }
    });

    const subjectMarks = Object.values(groupedMarks);
    res.json({ subject_marks: subjectMarks });
  } catch (error) {
    handleError(res, error, 'Error fetching subject marks');
  }
});

// Set subject marks
app.post('/api/subjects/set-marks', async (req, res) => {
  try {
    const subjectMarksData = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingData = await client.query('SELECT mark_id FROM subject_marks');
      const existingIds = existingData.rows.map(row => row.mark_id);
      const keptIds = [];

      for (const subjectMark of subjectMarksData) {
        // Process CP marks
        for (const cpMark of subjectMark.cp_marks) {
          if (cpMark.mark_id && existingIds.includes(cpMark.mark_id)) {
            // Update existing mark
            await client.query(`
              UPDATE subject_marks SET 
                value = $1, updated_at = CURRENT_TIMESTAMP 
              WHERE mark_id = $2
            `, [cpMark.value, cpMark.mark_id]);
            keptIds.push(cpMark.mark_id);
          } else {
            // Insert new mark
            const markId = cpMark.mark_id || uuidv4();
            await client.query(`
              INSERT INTO subject_marks (mark_id, subject_id, student_id, cp_id, value) 
              VALUES ($1, $2, $3, $4, $5)
            `, [markId, cpMark.subject_id, cpMark.student_id, cpMark.cp_id, cpMark.value]);
            keptIds.push(markId);
          }
        }

        // Process other marks
        for (const otherMark of subjectMark.other_marks) {
          if (otherMark.mark_id && existingIds.includes(otherMark.mark_id)) {
            // Update existing mark
            await client.query(`
              UPDATE subject_marks SET 
                value = $1, type = $2, updated_at = CURRENT_TIMESTAMP 
              WHERE mark_id = $3
            `, [otherMark.value, otherMark.type, otherMark.mark_id]);
            keptIds.push(otherMark.mark_id);
          } else {
            // Insert new mark
            const markId = otherMark.mark_id || uuidv4();
            await client.query(`
              INSERT INTO subject_marks (mark_id, subject_id, student_id, type, value) 
              VALUES ($1, $2, $3, $4, $5)
            `, [markId, otherMark.subject_id, otherMark.student_id, otherMark.type, otherMark.value]);
            keptIds.push(markId);
          }
        }
      }

      await client.query('COMMIT');
      res.json({ status: 200 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(res, error, 'Error setting subject marks');
  }
});

// Get notes and attendance by report ID
app.get('/api/reports/:report_id/notes-attendance', async (req, res) => {
  try {
    const { report_id } = req.params;
    const result = await pool.query('SELECT * FROM notes_attendances WHERE report_id = $1', [report_id]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Error fetching notes and attendance');
  }
});

// Create or update notes and attendance
app.post('/api/reports/:report_id/notes-attendance', async (req, res) => {
  try {
    const { report_id } = req.params;
    const notesAttendanceData = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get existing notes_attendance for this report
      const existingData = await client.query('SELECT id FROM notes_attendances WHERE report_id = $1', [report_id]);
      const existingIds = existingData.rows.map(row => row.id);
      const keptIds = [];

      // Process each notes_attendance record
      for (const na of notesAttendanceData) {
        if (na.id && existingIds.includes(na.id)) {
          // Update existing record
          await client.query(`
            UPDATE notes_attendances SET 
              notes = $1, sick = $2, leave = $3, alpha = $4, 
              updated_at = CURRENT_TIMESTAMP 
            WHERE id = $5
          `, [na.notes, na.sick, na.leave, na.alpha, na.id]);
          keptIds.push(na.id);
        } else {
          // Insert new record
          const id = na.id || uuidv4();
          await client.query(`
            INSERT INTO notes_attendances (id, report_id, student_id, notes, sick, leave, alpha) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [id, report_id, na.student_id, na.notes, na.sick, na.leave, na.alpha]);
          keptIds.push(id);
        }
      }

      // Delete records that are no longer in the data
      if (keptIds.length > 0) {
        await client.query(
          'DELETE FROM notes_attendances WHERE report_id = $1 AND id NOT IN (' + keptIds.map((_, i) => `$${i + 2}`).join(',') + ')',
          [report_id, ...keptIds]
        );
      } else {
        await client.query('DELETE FROM notes_attendances WHERE report_id = $1', [report_id]);
      }

      await client.query('COMMIT');
      res.json({ status: 200 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleError(res, error, 'Error updating notes and attendance');
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { nip, password } = req.body;

    // Fetch user with matching nip and password
    const result = await pool.query(
      'SELECT nip, name, npsn FROM users WHERE nip = $1 AND password = $2',
      [nip, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    handleError(res, error, 'Error during login');
  }
});

// User registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { nip, name, password } = req.body;

    // Check if user already exists
    const existing = await pool.query('SELECT nip FROM users WHERE nip = $1', [nip]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Insert new user
    await pool.query(
      'INSERT INTO users (nip, name, password, username) VALUES ($1, $2, $3, $4)',
      [nip, name, password, nip]
    );

    res.json({ status: 200 });
  } catch (error) {
    handleError(res, error, 'Error during registration');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

module.exports = app;