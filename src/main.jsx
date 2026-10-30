import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import "./style.css";

function App() {
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const emptyPatientForm = {
    full_name: "",
    phone: "",
    age: "",
    gender: "",
    address: "",
    diagnosis: "",
    medical_history: "",
  };

  const [form, setForm] = useState(emptyPatientForm);

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitMessage, setVisitMessage] = useState("");
  const [visitError, setVisitError] = useState("");

  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toLocaleDateString("en-CA"),
    treatment: "",
    notes: "",
    fee: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setLoginError(error.message);
      setSession(data?.session ?? null);
      setCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadPatients();
  }, [session]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoginError(error.message);
    } else {
      setSession(data.session);
      setPassword("");
    }

    setLoginLoading(false);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }

    setSession(null);
    setPatients([]);
    setSelectedPatient(null);
  }

  async function loadPatients() {
    setLoadingPatients(true);
    setError("");

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError("Patients load नहीं हुए: " + error.message);
    } else {
      setPatients(data || []);
    }

    setLoadingPatients(false);
  }

  async function generatePatientCode() {
    const { data, error } = await supabase
      .from("patients")
      .select("patient_code");

    if (error) throw error;

    let highestNumber = 0;

    (data || []).forEach((patient) => {
      const match = String(patient.patient_code || "").match(/^K(\d+)$/i);
      if (match) {
        highestNumber = Math.max(highestNumber, Number(match[1]));
      }
    });

    return "K" + String(highestNumber + 1).padStart(3, "0");
  }

  async function addPatient(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.full_name.trim()) {
      setError("कृपया Patient का नाम लिखें।");
      return;
    }

    setSaving(true);

    try {
      const patientCode = await generatePatientCode();

      const newPatient = {
        patient_code: patientCode,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        age: form.age === "" ? null : Number(form.age),
        gender: form.gender || null,
        address: form.address.trim() || null,
        diagnosis: form.diagnosis.trim() || null,
        medical_history: form.medical_history.trim() || null,
      };

      const { error } = await supabase
        .from("patients")
        .insert([newPatient]);

      if (error) throw error;

      setForm(emptyPatientForm);
      setMessage(`Patient सफलतापूर्वक सेव हुआ। Patient Code: ${patientCode}`);
      await loadPatients();
    } catch (err) {
      setError("Patient सेव नहीं हुआ: " + err.message);
    }

    setSaving(false);
  }

  async function openPatientHistory(patient) {
    setSelectedPatient(patient);
    setVisits([]);
    setVisitMessage("");
    setVisitError("");
    setLoadingVisits(true);

    setVisitForm({
      visit_date: new Date().toLocaleDateString("en-CA"),
      treatment: "",
      notes: "",
      fee: "",
    });

    const { data, error } = await supabase
      .from("visits")
      .select("*")
      .eq("patient_id", patient.id)
      .order("session_number", { ascending: false });

    if (error) {
      setVisitError("History लोड नहीं हुई: " + error.message);
    } else {
      setVisits(data || []);
    }

    setLoadingVisits(false);
  }

  function getNextSessionNumber() {
    const highestNumber = visits.reduce((highest, visit) => {
      return Math.max(highest, Number(visit.session_number) || 0);
    }, 0);

    return highestNumber + 1;
  }

  async function addVisit(event) {
    event.preventDefault();
    setVisitError("");
    setVisitMessage("");

    if (!selectedPatient) return;

    if (!visitForm.visit_date) {
      setVisitError("कृपया Session की तारीख चुनें।");
      return;
    }

    if (!visitForm.treatment.trim()) {
      setVisitError("कृपया Treatment लिखें।");
      return;
    }

    setSavingVisit(true);

    try {
      // नवीनतम Session Number डेटाबेस से भी चेक करें।
      const { data: latestVisits, error: latestError } = await supabase
        .from("visits")
        .select("session_number")
        .eq("patient_id", selectedPatient.id);

      if (latestError) throw latestError;

      const highestNumber = (latestVisits || []).reduce((highest, visit) => {
        return Math.max(highest, Number(visit.session_number) || 0);
      }, 0);

      const nextNumber = highestNumber + 1;

      const newVisit = {
        patient_id: selectedPatient.id,
        visit_date: visitForm.visit_date,
        treatment: visitForm.treatment.trim(),
        session_number: nextNumber,
        notes: visitForm.notes.trim() || null,
        fee: visitForm.fee === "" ? null : Number(visitForm.fee),
      };

      const { error } = await supabase
        .from("visits")
        .insert([newVisit]);

      if (error) throw error;

      setVisitMessage(`Session ${nextNumber} सफलतापूर्वक सेव हुआ।`);

      setVisitForm({
        visit_date: new Date().toLocaleDateString("en-CA"),
        treatment: "",
        notes: "",
        fee: "",
      });

      await openPatientHistory(selectedPatient);
      setVisitMessage(`Session ${nextNumber} सफलतापूर्वक सेव हुआ।`);
    } catch (err) {
      setVisitError("Session सेव नहीं हुआ: " + err.message);
    }

    setSavingVisit(false);
  }

  const filteredPatients = patients.filter((patient) => {
    const query = search.toLowerCase();

    return (
      String(patient.full_name || "").toLowerCase().includes(query) ||
      String(patient.patient_code || "").toLowerCase().includes(query) ||
      String(patient.phone || "").toLowerCase().includes(query)
    );
  });

  if (checkingAuth) {
    return <div className="app"><div className="card">Loading...</div></div>;
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

        <div className="card">
          <h2>Owner Login</h2>
          <form className="patient-form" onSubmit={handleLogin}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            {loginError && <p style={{ color: "red" }}>{loginError}</p>}

            <button type="submit" disabled={loginLoading}>
              {loginLoading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
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
        <button type="button" onClick={handleLogout}>
          Logout
        </button>
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
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                placeholder="Patient का पूरा नाम"
                required
              />

              <label>Mobile Number</label>
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                placeholder="Mobile number"
              />

              <label>Age</label>
              <input
                type="number"
                min="0"
                value={form.age}
                onChange={(e) =>
                  setForm({ ...form, age: e.target.value })
                }
                placeholder="Age"
              />

              <label>Gender</label>
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm({ ...form, gender: e.target.value })
                }
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>

              <label>Address</label>
              <input
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
                placeholder="Address"
              />

              <label>Diagnosis / Problem</label>
              <input
                value={form.diagnosis}
                onChange={(e) =>
                  setForm({ ...form, diagnosis: e.target.value })
                }
                placeholder="जैसे Frozen Shoulder, Back Pain"
              />

              <label>Medical History</label>
              <textarea
                value={form.medical_history}
                onChange={(e) =>
                  setForm({ ...form, medical_history: e.target.value })
                }
                placeholder="पुरानी बीमारी या अन्य जानकारी"
              />

              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Patient"}
              </button>
            </form>
          </section>

          <section className="card patient-list">
            <h2>Patient List</h2>
            <p>Total Patients: {patients.length}</p>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, patient code or phone"
            />

            {loadingPatients ? (
              <p>Loading patients...</p>
            ) : (
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
                    {filteredPatients.map((patient) => (
                      <tr key={patient.id}>
                        <td>{patient.patient_code}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openPatientHistory(patient)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#075fbd",
                              textDecoration: "underline",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            {patient.full_name}
                          </button>
                        </td>
                        <td>{patient.phone || "—"}</td>
                        <td>{patient.diagnosis || "—"}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openPatientHistory(patient)}
                          >
                            Open History
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredPatients.length === 0 && (
                      <tr>
                        <td colSpan="5">कोई Patient नहीं मिला।</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {selectedPatient && (
        <section className="card">
          <button
            type="button"
            onClick={() => {
              setSelectedPatient(null);
              setVisitError("");
              setVisitMessage("");
            }}
          >
            ← Back to Patient List
          </button>

          <h2>Patient History</h2>

          <div>
            <p><strong>Patient Code:</strong> {selectedPatient.patient_code}</p>
            <p><strong>Name:</strong> {selectedPatient.full_name}</p>
            <p><strong>Mobile:</strong> {selectedPatient.phone || "—"}</p>
            <p><strong>Age:</strong> {selectedPatient.age ?? "—"}</p>
            <p><strong>Gender:</strong> {selectedPatient.gender || "—"}</p>
            <p><strong>Diagnosis:</strong> {selectedPatient.diagnosis || "—"}</p>
            <p><strong>Medical History:</strong> {selectedPatient.medical_history || "—"}</p>
          </div>

          <hr />

          <h2>Add Daily Session</h2>
          <p>Next Session Number: <strong>{getNextSessionNumber()}</strong></p>

          <form className="patient-form" onSubmit={addVisit}>
            <label>Session Date *</label>
            <input
              type="date"
              value={visitForm.visit_date}
              onChange={(e) =>
                setVisitForm({ ...visitForm, visit_date: e.target.value })
              }
              required
            />

            <label>Treatment *</label>
            <input
              value={visitForm.treatment}
              onChange={(e) =>
                setVisitForm({ ...visitForm, treatment: e.target.value })
              }
              placeholder="जैसे IFT, Ultrasound, Exercise"
              required
            />

            <label>Notes</label>
            <textarea
              value={visitForm.notes}
              onChange={(e) =>
                setVisitForm({ ...visitForm, notes: e.target.value })
              }
              placeholder="Patient की स्थिति और progress"
            />

            <label>Session Fee (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={visitForm.fee}
              onChange={(e) =>
                setVisitForm({ ...visitForm, fee: e.target.value })
              }
              placeholder="Session fee"
            />

            {visitError && (
              <p style={{ color: "red", overflowWrap: "anywhere" }}>
                {visitError}
              </p>
            )}

            {visitMessage && (
              <p style={{ color: "green" }}>{visitMessage}</p>
            )}

            <button type="submit" disabled={savingVisit}>
              {savingVisit ? "Saving Session..." : "Save Daily Session"}
            </button>
          </form>

          <hr />

          <h2>Previous Sessions</h2>

          {loadingVisits ? (
            <p>History loading...</p>
          ) : visits.length === 0 ? (
            <p>अभी इस Patient का कोई Session दर्ज नहीं है।</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Session No.</th>
                    <th>Date</th>
                    <th>Treatment</th>
                    <th>Notes</th>
                    <th>Fee (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...visits]
                    .sort(
                      (a, b) =>
                        Number(a.session_number) - Number(b.session_number)
                    )
                    .map((visit) => (
                      <tr key={visit.id}>
                        <td>{visit.session_number}</td>
                        <td>{visit.visit_date || "—"}</td>
                        <td>{visit.treatment || "—"}</td>
                        <td>{visit.notes || "—"}</td>
                        <td>
                          {visit.fee === null || visit.fee === ""
                            ? "—"
                            : `₹${visit.fee}`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
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
