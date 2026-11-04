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
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toLocaleDateString("en-CA"),
    attendance_status: "Present", treatment: "", notes: "", fee: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "", payment_method: "Cash",
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
      email: email.trim(), password
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
      .from("patients").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setPatients(data || []);
  }

  async function nextPatientCode() {
    const { data, error } = await supabase
      .from("patients").select("patient_code");
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
