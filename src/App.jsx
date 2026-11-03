import { useState, useEffect } from "react";
import "./App.css";

// Backend API
const API_URL = "http://localhost:3000/expenses";

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Format transaction date
function formatDate(date) {
  if (!date) return "Date unavailable";

  const parts = date.split("-");
  if (parts.length !== 3) return date;

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const categories = [
  "Food & shopping",
  "Transportation",
  "Bills",
  "Entertainment",
  "Salary",
  "Income",
  "Other",
];

function App() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & shopping");
  const [type, setType] = useState("expense");
  const [date, setDate] = useState(getTodayDate());

  // Search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  // Monthly budget
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    try {
      const saved = localStorage.getItem("monthlyBudget");
      return saved !== null ? Number(saved) : 10000;
    } catch {
      return 10000;
    }
  });

  // GET: Fetch transactions from MongoDB through backend
  useEffect(() => {
    async function fetchExpenses() {
      try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not fetch transactions.");
        }

        if (!Array.isArray(data)) {
          throw new Error("Invalid transaction data received from backend.");
        }

        setExpenses(data);
        setError("");
      } catch (error) {
        console.error("Could not fetch transactions:", error);
        setError(error.message || "Could not connect to the backend.");
      } finally {
        setLoading(false);
      }
    }

    fetchExpenses();
  }, []);

  // Save budget in localStorage
  useEffect(() => {
    try {
      localStorage.setItem("monthlyBudget", String(monthlyBudget));
    } catch (error) {
      console.error("Could not save budget:", error);
    }
  }, [monthlyBudget]);

  // Calculate current month's expenses
  const currentMonth = getTodayDate().slice(0, 7);

  const monthlyExpenses = expenses
    .filter(
      (item) =>
        item.type === "expense" &&
        item.date &&
        item.date.slice(0, 7) === currentMonth,
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const remainingBudget = monthlyBudget - monthlyExpenses;

  const budgetPercentage =
    monthlyBudget > 0 ? (monthlyExpenses / monthlyBudget) * 100 : 0;

  const progressWidth = Math.min(budgetPercentage, 100);

  const budgetColor =
    budgetPercentage >= 100
      ? "#df5a5a"
      : budgetPercentage >= 80
        ? "#e5a323"
        : "#168653";

  // Search and filter transactions
  const filteredExpenses = expenses
    .filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === "all" || item.type === filterType;

      const matchesCategory =
        filterCategory === "all" || item.category === filterCategory;

      return matchesSearch && matchesType && matchesCategory;
    })
    .sort((a, b) => {
      const dateComparison = (b.date || "").localeCompare(a.date || "");
      return dateComparison || String(b.id).localeCompare(String(a.id));
    });

  // Reset form
  function resetForm() {
    setTitle("");
    setAmount("");
    setCategory("Food & shopping");
    setType("expense");
    setDate(getTodayDate());
    setEditingId(null);
    setShowForm(false);
  }

  // Open transaction for editing
  function editExpense(item) {
    setTitle(item.title);
    setAmount(String(item.amount));
    setCategory(item.category);
    setType(item.type);
    setDate(item.date || getTodayDate());
    setEditingId(item.id);
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // POST: Add transaction
  // PATCH: Update transaction
  async function addExpense(event) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const numericAmount = Number(amount);

    if (!cleanTitle || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("Enter a transaction name and a valid amount.");
      return;
    }

    if (!date || date > getTodayDate()) {
      alert("Please select a valid date that is not in the future.");
      return;
    }

    const transaction = {
      title: cleanTitle,
      amount: numericAmount,
      category,
      type,
      date,
    };

    try {
      const isEditing = editingId !== null;

      const url = isEditing ? `${API_URL}/${editingId}` : API_URL;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transaction),
      });

      // Read the backend response
      const data = await response.json();

      // Show the actual backend error
      if (!response.ok) {
        throw new Error(data.message || "Failed to save transaction.");
      }

      if (!data.expense) {
        throw new Error("Backend did not return the saved transaction.");
      }

      if (isEditing) {
        setExpenses((previous) =>
          previous.map((item) =>
            String(item.id) === String(editingId) ? data.expense : item,
          ),
        );
      } else {
        setExpenses((previous) => [data.expense, ...previous]);
      }

      setError("");
      resetForm();

      console.log("Transaction saved successfully:", data.expense);
    } catch (error) {
      console.error("Error saving transaction:", error);

      alert("Could not save transaction: " + error.message);
    }
  }

  // DELETE: Delete transaction from MongoDB
  async function deleteExpense(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this transaction?",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete transaction.");
      }

      setExpenses((previous) =>
        previous.filter((item) => String(item.id) !== String(id)),
      );

      if (String(editingId) === String(id)) {
        resetForm();
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);

      alert("Could not delete the transaction: " + error.message);
    }
  }

  // Export transactions to CSV
  function exportCSV() {
    if (expenses.length === 0) {
      alert("There are no transactions to export.");
      return;
    }

    const headers = ["Transaction", "Category", "Type", "Amount (INR)", "Date"];

    const escapeCSV = (value) => {
      let text = String(value ?? "");

      if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
      }

      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = expenses.map((item) => [
      item.title,
      item.category,
      item.type,
      Number(item.amount).toFixed(2),
      item.date || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `ExpenseFlow-${getTodayDate()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>🌿 ExpenseFlow</h2>
        <p className="active">▦ Dashboard</p>
        <p>↔ Transactions</p>
        <p>◷ Budgets</p>
        <p>⚙ Settings</p>
      </aside>

      <main className="main">
        <header>
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back! Here's your financial overview.</p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Add Transaction
          </button>
        </header>

        {/* Add or edit transaction */}
        {showForm && (
          <section className="transactions expense-form">
            <h2>
              {editingId !== null ? "Edit Transaction" : "Add a Transaction"}
            </h2>

            <form onSubmit={addExpense}>
              <label htmlFor="title">Transaction name</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Groceries"
                maxLength={100}
                required
              />

              <label htmlFor="amount">Amount (₹)</label>
              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Enter amount"
                required
              />

              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <label htmlFor="type">Transaction type</label>
              <select
                id="type"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>

              <label htmlFor="date">Transaction date</label>
              <input
                id="date"
                type="date"
                value={date}
                max={getTodayDate()}
                onChange={(event) => setDate(event.target.value)}
                required
              />

              <div className="form-actions">
                <button type="submit">
                  {editingId !== null
                    ? "Update Transaction"
                    : "Save Transaction"}
                </button>

                <button
                  type="button"
                  className="cancel-button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Monthly budget */}
        <section className="transactions budget-section">
          <h2>Monthly Budget</h2>

          <p className="budget-message">
            Track spending for{" "}
            {new Date().toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </p>

          <label htmlFor="monthlyBudget">Monthly spending limit (₹)</label>

          <input
            id="monthlyBudget"
            className="budget-input"
            type="number"
            min="1"
            step="0.01"
            value={monthlyBudget === 0 ? "" : monthlyBudget}
            onChange={(event) => {
              const value = event.target.value;
              setMonthlyBudget(value === "" ? 0 : Number(value));
            }}
          />

          <div className="budget-summary">
            <div>
              <p>Total Budget</p>
              <h3>₹{monthlyBudget.toLocaleString("en-IN")}</h3>
            </div>

            <div>
              <p>Spent This Month</p>
              <h3>₹{monthlyExpenses.toLocaleString("en-IN")}</h3>
            </div>

            <div>
              <p>Remaining</p>
              <h3 className={remainingBudget < 0 ? "red" : "green"}>
                ₹{remainingBudget.toLocaleString("en-IN")}
              </h3>
            </div>
          </div>

          <div
            className="budget-progress-track"
            role="progressbar"
            aria-label="Monthly budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(Math.max(budgetPercentage, 0), 100)}
          >
            <div
              className="budget-progress-fill"
              style={{
                width: `${progressWidth}%`,
                backgroundColor: budgetColor,
              }}
            />
          </div>

          <p className="budget-message">
            {monthlyBudget <= 0
              ? "Enter a budget greater than zero."
              : budgetPercentage >= 100
                ? "Budget exceeded! Try to reduce your spending."
                : budgetPercentage >= 80
                  ? "Warning: You are getting close to your budget."
                  : `${budgetPercentage.toFixed(1)}% of your budget used.`}
          </p>
        </section>

        {/* Transactions */}
        <section className="transactions">
          <div className="transaction-heading">
            <h2>Transactions</h2>

            <button type="button" className="export-button" onClick={exportCSV}>
              Export CSV
            </button>
          </div>

          <input
            type="text"
            className="search-input"
            placeholder="Search by name or category..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <div className="transaction-filters">
            <select
              className="filter-select"
              aria-label="Filter by transaction type"
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
            >
              <option value="all">All Transactions</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>

            <select
              className="filter-select"
              aria-label="Filter by category"
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
            >
              <option value="all">All Categories</option>

              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="empty-state">Loading transactions...</p>
          ) : error ? (
            <p className="empty-state">{error}</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="empty-state">No matching transactions found.</p>
          ) : (
            filteredExpenses.map((item) => (
              <div className="transaction" key={item.id}>
                <div className="transaction-info">
                  <strong>{item.title}</strong>
                  <p>
                    {item.category} · {formatDate(item.date)}
                  </p>
                </div>

                <div className="transaction-details">
                  <strong className={item.type === "income" ? "green" : "red"}>
                    {item.type === "income" ? "+" : "-"}₹
                    {Number(item.amount).toLocaleString("en-IN")}
                  </strong>

                  <button
                    type="button"
                    className="edit-button"
                    onClick={() => editExpense(item)}
                    aria-label={`Edit ${item.title}`}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => deleteExpense(item.id)}
                    aria-label={`Delete ${item.title}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <footer className="app-footer">
          <p>ExpenseFlow · Manage your money with confidence.</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
