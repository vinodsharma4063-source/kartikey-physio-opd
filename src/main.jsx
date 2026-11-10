
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import "./style.css";

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
      setVisits(visitResult.data || []);
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
      const nextNumber = isPresent ? max + 1 : null;

      const { error: insertError } = await supabase
        .from("visits")
        .insert([{
          patient_id: selectedPatient.id,
          visit_date: visitForm.visit_date,
          attendance_status: status,
          treatment: isPresent
            ? visitForm.treatment.trim()
            : status,
          session_number: nextNumber,
          notes: visitForm.notes.trim() || null,
          fee: isPresent
            ? (visitForm.fee === "" ? null : Number(visitForm.fee))
            : 0
        }]);

      if (insertError) throw insertError;

      setVisitForm({
        visit_date: new Date().toLocaleDateString("en-CA"),
        attendance_status: "Present",
        treatment: "",
        notes: "",
        fee: ""
      });

      setMessage(
        isPresent
          ? "Session " + nextNumber + " सेव हो गया।"
          : status + " Attendance सेव हो गई।"
      );

      await openHistory(selectedPatient);

    } catch (err) {
      setError("Attendance/Session सेव नहीं हुआ: " + err.message);
    }

    setLoading(false);
  }  
function printPatientBill(mode, singleVisit = null) {
  const patient = selectedPatient;

  let billVisits = [...visits];

  if (mode === "single") {
    billVisits = visits.filter(v => v.id === singleVisit.id);
  }

  if (mode === "range") {
    if (!billFromDate || !billToDate) {
      alert("कृपया From Date और To Date चुनें।");
      return;
    }

    billVisits = visits.filter(v =>
      v.visit_date >= billFromDate &&
      v.visit_date <= billToDate
    );
  }

  billVisits.sort((a, b) =>
    String(a.visit_date).localeCompare(String(b.visit_date))
  );

  if (billVisits.length === 0) {
    alert("इस अवधि में कोई Session रिकॉर्ड नहीं मिला।");
    return;
  }

  const totalFee = visits.reduce(
    (sum, v) => sum + Number(v.fee || 0), 0
  );

  const totalPaid = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0), 0
  );

  const balance = totalFee - totalPaid;

  const safe = value => String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const rows = billVisits.map(v => `
    <tr>
      <td>${safe(v.session_number)}</td>
      <td>${safe(v.visit_date)}</td>
      <td>${safe(v.attendance_status || "Present")}</td>
      <td>${safe(v.treatment)}</td>
      <td>₹${Number(v.fee || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  const paymentRows = payments.map(p => `
    <tr>
      <td>${safe(p.payment_date)}</td>
      <td>₹${Number(p.amount || 0).toFixed(2)}</td>
      <td>${safe(p.payment_method || "Cash")}</td>
    </tr>
  `).join("");

  const billWindow = window.open("", "_blank");

  if (!billWindow) {
    alert("कृपया इस वेबसाइट के लिए Pop-ups Allow करें।");
    return;
  }

  billWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Patient Bill</title>
      <style>
        body { font-family: Arial; padding: 25px; color: #222; }
        h1, h2, p { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #777; padding: 8px; text-align: left; }
        .line { border-top: 2px solid #333; margin: 15px 0; }
        .sign { display: flex; justify-content: space-between; margin-top: 75px; }
        .sign div { border-top: 1px solid #333; padding-top: 8px; width: 40%; text-align: center; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h1>Kartikey Physiotherapy Clinic</h1>
      <p>Lalkuan</p>
      <p>Physiotherapist Vinod Sharma | 9761230211</p>
      <div class="line"></div>

      <h2>${mode === "single" ? "SESSION BILL" : mode === "range" ? "DATE TO DATE BILL" : "COMPLETE PATIENT BILL"}</h2>

      <p><b>Patient Code:</b> ${safe(patient.patient_code)}</p>
      <p><b>Patient Name:</b> ${safe(patient.full_name)}</p>
      <p><b>Mobile:</b> ${safe(patient.phone)}</p>
      <p><b>Diagnosis:</b> ${safe(patient.diagnosis)}</p>

      <div class="line"></div>
      <h3>Session Details</h3>
      <table>
        <tr>
          <th>Session</th><th>Date</th><th>Attendance</th><th>Treatment</th><th>Fee</th>
        </tr>
        ${rows}
      </table>

      <h3>Patient Account Summary (All Dates)</h3>
      <p>Total Session Fees: ₹${totalFee.toFixed(2)}</p>
      <p>Total Paid: ₹${totalPaid.toFixed(2)}</p>
      <p><b>${balance > 0 ? "Balance Due" : "Advance / No Due"}: ₹${Math.abs(balance).toFixed(2)}</b></p>

      <h3>Payment History</h3>
      <table>
        <tr><th>Date</th><th>Amount</th><th>Method</th></tr>
        ${paymentRows || "<tr><td colspan='3'>No payment recorded</td></tr>"}
      </table>

      <div class="sign">
        <div>Patient Signature</div>
        <div>Clinic Signature</div>
      </div>

      <script>
        window.onload = function() { window.print(); };
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
    Math.max(0, ...visits.map(v => Number(v.session_number) || 0)) + 1;

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
            <h1>Kartikey Physiotherapy Clinic</h1>
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
          <h1>Kartikey Physiotherapy Clinic</h1>
          <p>Lalkuan — OPD Management System</p>
          <p>Physiotherapist Vinod Sharma | 9761230211</p>
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
              <option value="Holiday">Holiday</option>
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
              value={visitForm.notes}
              onChange={e => setVisitForm({
                ...visitForm, notes: e.target.value
              })}
            />

            <button disabled={loading}>
              {loading ? "Saving..." : "Save Attendance / Session"}
            </button>
          </form>

          <h2>Previous Sessions & Attendance</h2>

<div style={{ margin: "15px 0", padding: "15px", border: "1px solid #ccc", borderRadius: "8px" }}>
  <h3>Patient Bill Options</h3>

  <button type="button" onClick={() => printPatientBill("all")}>
    Complete Patient Bill PDF
  </button>

  <div style={{ marginTop: "12px" }}>
    <label>From Date</label>
    <input
      type="date"
      value={billFromDate}
      onChange={e => setBillFromDate(e.target.value)}
    />

    <label>To Date</label>
    <input
      type="date"
      value={billToDate}
      onChange={e => setBillToDate(e.target.value)}
    />

    <button
      type="button"
      onClick={() => printPatientBill("range")}
    >
      Date-to-Date Bill PDF
    </button>
  </div>
</div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Session</th>
<th>Date</th>
                  <th>Attendance</th>
                  <th>Treatment</th>
                  <th>Notes</th>
                  <th>Fee</th> 
                  <th>Bill PDF</th>
                </tr>
              </thead>

              <tbody>
                {visits.map(v => {
                  const status = v.attendance_status || "Present";

                  return (
                    <tr key={v.id}>
                      <td>{v.session_number ?? "—"}</td>
                      <td>{v.visit_date}</td>
                      <td>{status}</td>
                      <td>
                        {status === "Present"
                          ? (v.treatment || "—")
                          : "—"}
                      </td>
                      <td>{v.notes || "—"}</td>
                      <td>
                        {v.fee == null ? "—" : "₹" + v.fee}
                      </td>
                      <td>
  <button
    type="button"
    onClick={() => printSessionBill(v)}
  >
    Print / Save PDF
  </button>
</td>
                    </tr>
                  );
                })}

                {visits.length === 0 && (
                  <tr>
                    <td colSpan="7">
                      अभी कोई Attendance / Session नहीं है।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <hr />

          <h2>Payment & Balance</h2>

          <div className="card">
            <p>
              <strong>Total Session Fees:</strong>{" "}
              ₹{totalFee.toFixed(2)}
            </p>

            <p>
              <strong>Total Paid:</strong>{" "}
              ₹{totalPaid.toFixed(2)}
            </p>

            <p style={{ color: balance > 0 ? "red" : "green" }}>
              <strong>
                {balance > 0 ? "Balance Due:" : "Advance / No Due:"}
              </strong>
              {" ₹" + Math.abs(balance).toFixed(2)}
            </p>
          </div>

          <h3>Add New Payment</h3>

          <form className="patient-form" onSubmit={addPayment}>
            <label>Payment Amount (₹) *</label>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={paymentForm.amount}
              onChange={e => setPaymentForm({
                ...paymentForm, amount: e.target.value
              })}
              placeholder="जितनी रकम मिली है"
              required
            />

            <label>Payment Date *</label>

            <input
              type="date"
              value={paymentForm.payment_date}
              onChange={e => setPaymentForm({
                ...paymentForm, payment_date: e.target.value
              })}
              required
            />

            <label>Payment Method</label>

            <select
              value={paymentForm.payment_method}
              onChange={e => setPaymentForm({
                ...paymentForm, payment_method: e.target.value
              })}
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option>Bank Transfer</option>
            </select>

            <label>Notes</label>

            <textarea
              value={paymentForm.notes}
              onChange={e => setPaymentForm({
                ...paymentForm, notes: e.target.value
              })}
              placeholder="Payment की जानकारी"
            />

            <button disabled={loading}>
              {loading ? "Saving..." : "Save Payment"}
            </button>
          </form>

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
        Kartikey Physiotherapy Clinic, Lalkuan
        <br />
        Physiotherapist Vinod Sharma | 9761230211
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
