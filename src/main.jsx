import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import "./style.css";

const CLINIC_NAME = "Kartikey Physiotherapy & Rehabilitation Clinic";
const CLINIC_ADDRESS =
  "Near Railway Station, Opposite to Nainital Bank, Lalkuan, District Nainital (Uttarakhand) – 262402";
const PHYSIOTHERAPIST = "Dr. Vinod Sharma (Physiotherapist, BPT)";
const REGISTRATION_NUMBER = "BPT/029";
const CLINIC_MOBILE = "9761230211";


function sortAndNumberVisits(rows) {
  const sorted = [...(rows || [])].sort((a, b) => {
    const dateCompare = String(a.visit_date || "").localeCompare(
      String(b.visit_date || "")
    );

    if (dateCompare !== 0) return dateCompare;

    return Number(a.session_number || 0) -
           Number(b.session_number || 0);
  });

  let sessionNumber = 0;

  return sorted.map(v => {
    const isPresent =
      (v.attendance_status || "Present") === "Present";

    return {
      ...v,
      display_session_number: isPresent
        ? ++sessionNumber
        : null
    };
  });
}
function formatDisplayDate(dateValue) {
  if (!dateValue) return "—";

  const datePart = String(dateValue).slice(0, 10);
  const parts = datePart.split("-");

  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }

  return datePart;
}
function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    full_name: "", phone: "", age: "", gender: "",
    address: "", diagnosis: "", medical_history: ""
  });

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [billFromDate, setBillFromDate] = useState("");
  const [billToDate, setBillToDate] = useState("");
const [billFromText, setBillFromText] = useState("");
const [billToText, setBillToText] = useState("");
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toLocaleDateString("en-CA"),
    attendance_status: "Present",
    treatment: "",
    notes: "",
    fee: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "Cash",
    payment_date: new Date().toLocaleDateString("en-CA"),
    notes: ""
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadPatients();
  }, [session]);

  async function login(e) {
    e.preventDefault();
    setLoginError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) setLoginError(error.message);
    else setSession(data.session);

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setSelectedPatient(null);
  }

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setPatients(data || []);
  }

  async function nextPatientCode() {
    const { data, error } = await supabase
      .from("patients")
      .select("patient_code");

    if (error) throw error;

    let max = 0;

    (data || []).forEach(p => {
      const match = String(p.patient_code || "").match(/^K(\d+)$/i);
      if (match) max = Math.max(max, Number(match[1]));
    });

    return "K" + String(max + 1).padStart(3, "0");
  }

  async function addPatient(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.full_name.trim()) {
      setError("Patient का नाम लिखें।");
      return;
    }

    setLoading(true);

    try {
      const code = await nextPatientCode();

      const { error } = await supabase.from("patients").insert([{
        patient_code: code,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        age: form.age === "" ? null : Number(form.age),
        gender: form.gender || null,
        address: form.address.trim() || null,
        diagnosis: form.diagnosis.trim() || null,
        medical_history: form.medical_history.trim() || null
      }]);

      if (error) throw error;

      setForm({
        full_name: "", phone: "", age: "", gender: "",
        address: "", diagnosis: "", medical_history: ""
      });

      setMessage("Patient सेव हो गया। Patient Code: " + code);
      await loadPatients();

    } catch (err) {
      setError("Patient सेव नहीं हुआ: " + err.message);
    }

    setLoading(false);
  }

  async function openHistory(patient) {
    setSelectedPatient(patient);
    setVisits([]);
    setPayments([]);
    setError("");
    setMessage("");

    const [visitResult, paymentResult] = await Promise.all([
      supabase.from("visits").select("*")
        .eq("patient_id", patient.id)
        .order("session_number", { ascending: true }),

      supabase.from("payments").select("*")
        .eq("patient_id", patient.id)
        .order("payment_date", { ascending: false })
    ]);

    if (visitResult.error) {
      setError("Session History: " + visitResult.error.message);
    } else {
      setVisits(sortAndNumberVisits(visitResult.data || []));
    }

    if (paymentResult.error) {
      setError("Payment History: " + paymentResult.error.message);
    } else {
      setPayments(paymentResult.data || []);
    }
  }

  async function addVisit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const status = visitForm.attendance_status;

    if (status === "Present" && !visitForm.treatment.trim()) {
      setError("Present होने पर Treatment लिखें।");
      return;
    }

    setLoading(true);

    try {
      // पहले नया Attendance / Session सेव करें
      const { data, error } = await supabase
        .from("visits")
        .select("session_number")
        .eq("patient_id", selectedPatient.id);

      if (error) throw error;

      const max = (data || []).reduce(
        (n, v) => Math.max(n, Number(v.session_number) || 0),
        0
      );

      const isPresent = status === "Present";

      const { error: insertError } = await supabase
        .from("visits")
        .insert([{
          patient_id: selectedPatient.id,
          visit_date: visitForm.visit_date,
          attendance_status: status,
          treatment: isPresent
            ? visitForm.treatment.trim()
            : status,
          session_number: isPresent ? max + 1 : null,
          notes: visitForm.notes.trim() || null,
          fee: isPresent
            ? (visitForm.fee === "" ? null : Number(visitForm.fee))
            : 0
        }]);

      if (insertError) throw insertError;

      // अब मरीज के सभी रिकॉर्ड दोबारा प्राप्त करें
      const { data: allRows, error: historyError } = await supabase
        .from("visits")
        .select("id, visit_date, attendance_status, session_number")
        .eq("patient_id", selectedPatient.id);

      if (historyError) throw historyError;

      // तारीख के अनुसार क्रम लगाएँ
      // एक ही तारीख होने पर पुराना Session पहले रहेगा
      const sortedRows = [...(allRows || [])].sort((a, b) => {
        const dateCompare = String(a.visit_date || "").localeCompare(
          String(b.visit_date || "")
        );

        if (dateCompare !== 0) return dateCompare;

        return Number(a.session_number || 0) -
          Number(b.session_number || 0);
      });

      // केवल Present को Session Number दें
      let sessionNumber = 0;

      for (const row of sortedRows) {
        const isRowPresent =
          (row.attendance_status || "Present") === "Present";

        const newNumber = isRowPresent
          ? ++sessionNumber
          : null;

        const oldNumber = row.session_number == null
          ? null
          : Number(row.session_number);

        // केवल जरूरत होने पर Database अपडेट करें
        if (oldNumber !== newNumber) {
          const { error: updateError } = await supabase
            .from("visits")
            .update({ session_number: newNumber })
            .eq("id", row.id);

          if (updateError) throw updateError;
        }
      }

      setVisitForm({
        visit_date: new Date().toLocaleDateString("en-CA"),
        attendance_status: "Present",
        treatment: "",
        notes: "",
        fee: ""
      });

      await openHistory(selectedPatient);

      setMessage(
        isPresent
          ? "Session सेव हो गया। सभी Session Number तारीख के अनुसार अपडेट हो गए।"
          : status + " Attendance सेव हो गई। Session Number अपडेट हो गए।"
      );

    } catch (err) {
      setError("Attendance/Session सेव नहीं हुआ: " + err.message);
    }

    setLoading(false);
  }

  

function updateBillDateInput(value, setText, setDate) {
  const raw = String(value || "").trim();
  let dayPart = "";
  let monthPart = "";
  let yearPart = "";
  let formatted = "";

  // Respect separators when users type dates like 9-11-2026.
  if (raw.includes("-") || raw.includes("/")) {
    const parts = raw.split(/[-/]/);
    dayPart = (parts[0] || "").replace(/\D/g, "").slice(0, 2);
    monthPart = (parts[1] || "").replace(/\D/g, "").slice(0, 2);
    yearPart = (parts[2] || "").replace(/\D/g, "").slice(0, 4);
    const displayDay = raw.split(/[-/]/).length > 1 && dayPart.length === 1 && monthPart
      ? dayPart.padStart(2, "0") : dayPart;
    formatted = displayDay;
    if (raw.includes("-") || raw.includes("/")) formatted += "-" + monthPart;
    if (parts.length > 2) formatted += "-" + yearPart;
  } else {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    dayPart = digits.slice(0, 2);
    monthPart = digits.slice(2, 4);
    yearPart = digits.slice(4, 8);
    formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + "-" + digits.slice(2);
    if (digits.length > 4) formatted = digits.slice(0, 2) + "-" + digits.slice(2, 4) + "-" + digits.slice(4);
  }

  setText(formatted);
  if (!dayPart || !monthPart || yearPart.length !== 4) {
    setDate("");
    return;
  }

  const day = Number(dayPart);
  const month = Number(monthPart);
  const year = Number(yearPart);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
    setDate(\`\${year}-\${String(month).padStart(2, "0")}-\${String(day).padStart(2, "0")}\`);
    if (raw.includes("-") || raw.includes("/")) {
      setText(\`\${String(day).padStart(2, "0")}-\${String(month).padStart(2, "0")}-\${year}\`);
    }
  } else {
    setDate("");
  }
}

function printPatientBill(mode, singleVisit = null) {
  const patient = selectedPatient;

  if (!patient) {
    alert("कृपया पहले Patient चुनें।");
    return;
  }

  if (mode === "single" && !singleVisit) {
  alert("कृपया पहले Session चुनें।");
  return;
}

const safe = value =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const money = value => Number(value || 0).toFixed(2);

  // पूरे मरीज के खाते के सभी Sessions
  const allVisits = [...visits].sort((a, b) => {
    const dateCompare = String(a.visit_date || "").localeCompare(
      String(b.visit_date || "")
    );

    if (dateCompare !== 0) return dateCompare;

    return Number(a.session_number || 0) -
      Number(b.session_number || 0);
  });

  // पूरे मरीज के खाते के सभी Payments
  const allPayments = [...payments].sort((a, b) =>
    String(a.payment_date || "").localeCompare(
      String(b.payment_date || "")
    )
  );

  // चुने हुए Bill के Sessions
  let billVisits = [...allVisits];

  if (mode === "single") {
    billVisits = allVisits.filter(v => v.id === singleVisit.id);
  }

  if (mode === "range") {
    billVisits = allVisits.filter(v =>
      v.visit_date >= billFromDate &&
      v.visit_date <= billToDate
    );
  }

  if (billVisits.length === 0) {
    alert("इस अवधि में कोई Session रिकॉर्ड नहीं मिला।");
    return;
  }

  // पूरे खाते का हिसाब
  const totalFee = allVisits.reduce(
    (sum, v) => sum + Number(v.fee || 0), 0
  );

  const totalPaid = allPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0), 0
  );

  const balance = totalFee - totalPaid;

  // चुनी हुई अवधि के Payments
  const billPayments = mode === "range"
    ? allPayments.filter(p =>
        p.payment_date >= billFromDate &&
        p.payment_date <= billToDate
      )
    : allPayments;

  const billTotalFee = billVisits.reduce(
    (sum, v) => sum + Number(v.fee || 0), 0
  );

  const billTotalPaid = billPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0), 0
  );

  const billDifference = billTotalFee - billTotalPaid;

  const rows = billVisits.map(v => `
    <tr>
      <td>${safe(v.display_session_number ?? v.session_number ?? "-")}</td>
      <td>${safe(formatDisplayDate(v.visit_date))}</td>
      <td>${safe(v.attendance_status || "Present")}</td>
      <td>${safe(v.treatment || "—")}</td>
      <td>₹${money(v.fee)}</td>
    </tr>
  `).join("");

  const paymentRows = billPayments.map(p => `
    <tr>
      <td>${safe(formatDisplayDate(p.payment_date))}</td>
      <td>₹${money(p.amount)}</td>
      <td>${safe(p.payment_method || "Cash")}</td>
    </tr>
  `).join("");

  const periodSummary = mode === "range" ? `
    <h3>Selected Period Summary</h3>
    <div class="summary">
      <p>From Date: ${safe(formatDisplayDate(billFromDate))}</p>
      <p>To Date: ${safe(formatDisplayDate(billToDate))}</p>
      <p>Total Sessions / Entries: ${billVisits.length}</p>
      <p>Present: ${billVisits.filter(v =>
        (v.attendance_status || "Present") === "Present"
      ).length}</p>
      <p>Absent: ${billVisits.filter(v =>
        v.attendance_status === "Absent"
      ).length}</p>
      <p>Holiday: ${billVisits.filter(v =>
        v.attendance_status === "Holiday"
      ).length}</p>
      <p>Period Session Fees: ₹${money(billTotalFee)}</p>
      <p>Payments Received in Period: ₹${money(billTotalPaid)}</p>
      <p class="balance">
        Period Difference: ₹${money(Math.abs(billDifference))}
        (${billDifference > 0 ? "Fees exceed period payments" :
          billDifference < 0 ? "Payments exceed period fees" : "Settled"})
      </p>
    </div>
  ` : mode === "single" ? `
    <h3>Selected Session Summary</h3>
    <div class="summary">
      <p>Selected Session Fee: ₹${money(billTotalFee)}</p>
      <p>Attendance: ${safe(billVisits[0].attendance_status || "Present")}</p>
    </div>
  ` : "";

  const billTitle = mode === "single"
    ? "SINGLE SESSION BILL"
    : mode === "range"
      ? "DATE TO DATE BILL"
      : "COMPLETE SESSION OF PHYSIOTHERAPY BILL";

  const billWindow = window.open("", "_blank");

  if (!billWindow) {
    alert("कृपया इस वेबसाइट के लिए Pop-ups Allow करें।");
    return;
  }

  billWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${billTitle}</title>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 24px;
          color: #202938;
          max-width: 900px;
          margin: 0 auto;
        }

        .clinic-header {
          text-align: center;
          border-bottom: 3px solid #174a72;
          padding-bottom: 14px;
        }

        .clinic-header h1 {
          margin: 0 0 8px;
          color: #174a72;
          font-size: 23px;
        }

        .clinic-header p {
          margin: 4px 0;
          line-height: 1.4;
        }

        h2 {
          text-align: center;
          color: #174a72;
        }

        h3 {
          color: #174a72;
          margin-top: 20px;
        }

        .patient-info p {
          text-align: left;
          margin: 7px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }

        th, td {
          border: 1px solid #9aa8b5;
          padding: 9px 8px;
          text-align: left;
          font-size: 13px;
        }

        th {
          background: #eaf0f5;
        }

        .line {
          border-top: 1px solid #c4ced8;
          margin: 15px 0;
        }

        .summary {
          border: 1px solid #d5dee7;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 15px;
        }

        .summary p {
          text-align: left;
          margin: 8px 0;
        }

        .balance {
          font-weight: bold;
          color: #9b2525;
        }

        .sign {
          display: flex;
          justify-content: space-between;
          margin-top: 75px;
        }

        .sign div {
          border-top: 1px solid #333;
          padding-top: 8px;
          width: 40%;
          text-align: center;
        }

        @media print {
          body {
            padding: 8mm;
          }

          tr {
            break-inside: avoid;
          }
        }
      </style>
    </head>

    <body>
      <div class="clinic-header">
        <h1>${safe(CLINIC_NAME)}</h1>
        <p>${safe(CLINIC_ADDRESS)}</p>
        <p><strong>${safe(PHYSIOTHERAPIST)}</strong></p>
        <p>
          Registration No.: ${safe(REGISTRATION_NUMBER)}
          | Mobile: ${safe(CLINIC_MOBILE)}
        </p>
      </div>

      <div class="line"></div>

      <h2>${billTitle}</h2>

      <div class="patient-info">
        <p><b>Patient Code:</b> ${safe(patient.patient_code)}</p>
        <p><b>Patient Name:</b> ${safe(patient.full_name)}</p>
        <p><b>Mobile:</b> ${safe(patient.phone)}</p>
        <p><b>Diagnosis:</b> ${safe(patient.diagnosis)}</p>
      </div>

      <div class="line"></div>

      ${periodSummary}

      <h3>Session Details</h3>
      <table>
        <tr>
          <th>Session</th>
          <th>Date</th>
          <th>Attendance</th>
          <th>Treatment</th>
          <th>Fee</th>
        </tr>
        ${rows}
      </table>

      <h3>Patient Account Summary (All Dates)</h3>
      <div class="summary">
        <p>Total Session Fees: ₹${money(totalFee)}</p>
        <p>Total Paid: ₹${money(totalPaid)}</p>
        <p class="balance">
          ${balance > 0 ? "Balance Due" :
            balance < 0 ? "Advance Payment" : "No Due"}:
          ₹${money(Math.abs(balance))}
        </p>
      </div>

      <h3>
        ${mode === "range"
          ? "Payment History (Selected Period)"
          : "Payment History (All Dates)"}
      </h3>

      <table>
        <tr>
          <th>Date</th>
          <th>Amount</th>
          <th>Method</th>
        </tr>
        ${paymentRows ||
          "<tr><td colspan='3'>No payment recorded</td></tr>"}
      </table>

      <div class="sign">
        <div>Patient Signature</div>
        <div>Clinic Signature</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  billWindow.document.close();
}

 
  function printSessionBill(visit) {
    printPatientBill("single", visit);
  }

  async function addPayment(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const amount = Number(paymentForm.amount);

    if (!amount || amount <= 0) {
      setError("कृपया सही Payment Amount भरें।");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("payments").insert([{
        patient_id: selectedPatient.id,
        amount,
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        notes: paymentForm.notes.trim() || null
      }]);

      if (error) throw error;

      setPaymentForm({
        amount: "",
        payment_method: "Cash",
        payment_date: new Date().toLocaleDateString("en-CA"),
        notes: ""
      });

      setMessage("Payment सफलतापूर्वक सेव हो गई।");
      await openHistory(selectedPatient);

    } catch (err) {
      setError("Payment सेव नहीं हुई: " + err.message);
    }

    setLoading(false);
  }

  const totalFee = visits.reduce(
    (sum, v) => sum + (Number(v.fee) || 0), 0
  );

  const totalPaid = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0), 0
  );

  const balance = totalFee - totalPaid;


  const nextSessionNumber =
  visits.filter(v =>
    (v.attendance_status || "Present") === "Present" &&
    v.visit_date <= visitForm.visit_date
  ).length + 1;

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();

    return String(p.full_name || "").toLowerCase().includes(q) ||
      String(p.patient_code || "").toLowerCase().includes(q) ||
      String(p.phone || "").includes(q);
  });

  if (checking) {
    return <div className="app">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">K</div>

          <div>
            <h1>{CLINIC_NAME}</h1>
            <p>{CLINIC_ADDRESS}</p>
            <p>Lalkuan — OPD Management System</p>
          </div>
        </header>

        <section className="card">
          <h2>Owner Login</h2>

          <form className="patient-form" onSubmit={login}>
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            {loginError && (
              <p style={{ color: "red" }}>{loginError}</p>
            )}

            <button disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">K</div>

        <div>
          <h1>{CLINIC_NAME}</h1>
          <p>{CLINIC_ADDRESS}</p>
          <p>Lalkuan — OPD Management System</p>
          <p>
            {PHYSIOTHERAPIST} |
            Reg. No.: {REGISTRATION_NUMBER} |
            {CLINIC_MOBILE}
          </p>
        </div>

        <button onClick={logout}>Logout</button>
      </header>

      {error && (
        <div className="card" style={{ color: "red" }}>
          {error}
        </div>
      )}

      {message && (
        <div className="card" style={{ color: "green" }}>
          {message}
        </div>
      )}

      {!selectedPatient && (
        <>
          <section className="card">
            <h2>Add New Patient</h2>

            <form className="patient-form" onSubmit={addPatient}>
              <label>Patient Name *</label>

              <input
                value={form.full_name}
                onChange={e => setForm({
                  ...form, full_name: e.target.value
                })}
                required
              />

              <label>Mobile Number</label>

              <input
                value={form.phone}
                onChange={e => setForm({
                  ...form, phone: e.target.value
                })}
              />

              <label>Age</label>

              <input
                type="number"
                value={form.age}
                onChange={e => setForm({
                  ...form, age: e.target.value
                })}
              />

              <label>Gender</label>

              <select
                value={form.gender}
                onChange={e => setForm({
                  ...form, gender: e.target.value
                })}
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>

              <label>Address</label>

              <input
                value={form.address}
                onChange={e => setForm({
                  ...form, address: e.target.value
                })}
              />

              <label>Diagnosis / Problem</label>

              <input
                value={form.diagnosis}
                onChange={e => setForm({
                  ...form, diagnosis: e.target.value
                })}
              />

              <label>Medical History</label>

              <textarea
                value={form.medical_history}
                onChange={e => setForm({
                  ...form, medical_history: e.target.value
                })}
              />

              <button disabled={loading}>Save Patient</button>
            </form>
          </section>

          <section className="card patient-list">
            <h2>Patient List</h2>
            <p>Total Patients: {patients.length}</p>

            <input
              placeholder="Search name, code or phone"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient Code</th>
                    <th>Patient Name</th>
                    <th>Mobile</th>
                    <th>Diagnosis</th>
                    <th>History</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td>{p.patient_code}</td>

                      <td>
                        <button
                          type="button"
                          onClick={() => openHistory(p)}
                          style={{
                            background: "none",
                            color: "#075fbd",
                            padding: 0
                          }}
                        >
                          {p.full_name}
                        </button>
                      </td>

                      <td>{p.phone || "—"}</td>
                      <td>{p.diagnosis || "—"}</td>

                      <td>
                        <button onClick={() => openHistory(p)}>
                          Open History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selectedPatient && (
        <section className="card">
          <button onClick={() => {
            setSelectedPatient(null);
            setError("");
            setMessage("");
          }}>
            ← Back to Patient List
          </button>

          <h2>Patient History</h2>

          <p>
            <strong>Patient Code:</strong>{" "}
            {selectedPatient.patient_code}
          </p>

          <p>
            <strong>Name:</strong> {selectedPatient.full_name}
          </p>

          <p>
            <strong>Mobile:</strong> {selectedPatient.phone || "—"}
          </p>

          <p>
            <strong>Age:</strong> {selectedPatient.age ?? "—"}
          </p>

          <p>
            <strong>Gender:</strong> {selectedPatient.gender || "—"}
          </p>

          <p>
            <strong>Diagnosis:</strong>{" "}
            {selectedPatient.diagnosis || "—"}
          </p>

          <p>
            <strong>Medical History:</strong>{" "}
            {selectedPatient.medical_history || "—"}
          </p>

          <hr />

          <h2>Daily Attendance / Session</h2>

          <p>
            Next Session Number: <strong>{nextSessionNumber}</strong>
          </p>

          <form className="patient-form" onSubmit={addVisit}>
            <label>Date *</label>

            <input
              type="date"
              value={visitForm.visit_date}
              onChange={e => setVisitForm({
                ...visitForm, visit_date: e.target.value
              })}
              required
            />

            <label>Attendance Status *</label>

            <select
              value={visitForm.attendance_status}
              onChange={e => setVisitForm({
                ...visitForm,
                attendance_status: e.target.value
              })}
              required
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
<option value="Sunday">Sunday (Weekly Holiday)</option>
<option value="Holiday">Other Holiday</option>
            </select>

            {visitForm.attendance_status === "Present" && (
              <>
                <label>Treatment *</label>

                <input
                  value={visitForm.treatment}
                  onChange={e => setVisitForm({
                    ...visitForm, treatment: e.target.value
                  })}
                  placeholder="IFT, Ultrasound, Exercise"
                  required
                />

                <label>Session Fee (₹)</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={visitForm.fee}
                  onChange={e => setVisitForm({
                    ...visitForm, fee: e.target.value
                  })}
                />
              </>
            )}


            <label>Notes</label>

            <textarea
              rows={3}
              value={visitForm.notes}
              onChange={e => setVisitForm({
                ...visitForm,
                notes: e.target.value
              })}
            />

            <button type="submit">
              Save Daily Session
            </button>
          </form>


          <h3>Previous Sessions & Attendance</h3>

          <div style={{ margin: "15px 0", padding: "15px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>Patient Bill Options</h3>
            <button type="button" onClick={() => printPatientBill("all")}>
              Complete Session of Physiotherapy Bill PDF
            </button>
            <div style={{ marginTop: "12px" }}>
              <label>From Date (DD-MM-YYYY)</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10}
                  style={{ flex: 1, minWidth: 0 }}
                  value={billFromText}
                  onChange={e => updateBillDateInput(e.target.value, setBillFromText, setBillFromDate)}
                />
                <input type="date" aria-label="From Date calendar" value={billFromDate}
                  style={{ width: "42px", minWidth: "42px", padding: "8px", cursor: "pointer" }}
                  onChange={e => {
                    setBillFromDate(e.target.value);
                    setBillFromText(e.target.value ? formatDisplayDate(e.target.value) : "");
                  }}
                />
              </div>
              <label>To Date (DD-MM-YYYY)</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10}
                  style={{ flex: 1, minWidth: 0 }}
                  value={billToText}
                  onChange={e => updateBillDateInput(e.target.value, setBillToText, setBillToDate)}
                />
                <input type="date" aria-label="To Date calendar" value={billToDate}
                  style={{ width: "42px", minWidth: "42px", padding: "8px", cursor: "pointer" }}
                  onChange={e => {
                    setBillToDate(e.target.value);
                    setBillToText(e.target.value ? formatDisplayDate(e.target.value) : "");
                  }}
                />
              </div>
              <button type="button" onClick={() => {
                if (!billFromDate || !billToDate) { alert("कृपया From Date और To Date दोनों चुनें।"); return; }
                if (billFromDate > billToDate) { alert("From Date, To Date से पहले या बराबर होनी चाहिए।"); return; }
                printPatientBill("range");
              }}>
                Date-to-Date Bill PDF
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Session No.</th>
                  <th>Date</th>
                  <th>Attendance</th>
                  <th>Treatment</th>
                  <th>Fee</th>
                  <th>Notes</th>
                  <th>Bill PDF</th>
                </tr>
              </thead>

              <tbody>
                {visits.length > 0 ? (
                  visits.map((v, index) => (
                    <tr key={v.id || index}>
                      <td>{v.display_session_number || "—"}</td>
                      <td>
                        {String(v.visit_date || "")
                          .slice(0, 10)
                          .split("-")
                          .reverse()
                          .join("-")}
                      </td>
                      <td>{v.attendance_status || "—"}</td>
                      <td>{v.treatment || "—"}</td>
                      <td>
                        ₹{Number(v.fee || 0).toFixed(2)}
                      </td>
                      <td>{v.notes || "—"}</td>
                      <td><button type="button" onClick={() => printSessionBill(v)}>Print / Save PDF</button></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">
                      No Previous Sessions Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3>Payment History</h3>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.payment_date}</td>
                    <td>₹{Number(p.amount).toFixed(2)}</td>
                    <td>{p.payment_method || "Cash"}</td>
                    <td>{p.notes || "—"}</td>
                  </tr>
                ))}

                {payments.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      अभी कोई Payment दर्ज नहीं है।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer style={{ textAlign: "center", padding: "20px" }}>
        {CLINIC_NAME}
        <br />
        {PHYSIOTHERAPIST} | Reg. No.: {REGISTRATION_NUMBER} | {CLINIC_MOBILE}
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
