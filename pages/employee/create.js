import { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { API_URL } from "../../config/index";

export default function CreateEmployee() {
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    imageURL: "",
  });

  const router = useRouter();

  // handle form submission and send data to API
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    const hasEmptyFields = Object.values(values).some(
      (element) => element === ""
    );

    if (hasEmptyFields) {
      alert("Please fill in all fields");
    }

    const res = await fetch(`${API_URL}/api/employees`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      console.log("error");
    } else {
      const employee = await res.json();
      router.push(`/`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
  };

  return (
    <Layout>
      <h1 className="text-3xl font-bold mb-5">Add Employee</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-2 lg:gap-6">
          <div className="mb-5 lg:mb-0">
            <label className="block text-sm font-bold mb-2">
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              value={values.firstName}
              onChange={handleInputChange}
              className="shadow appearance-none rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:shadow-outline bg-slate-700"
              placeholder="First Name"
            />
          </div>
          <div className="lg:mb-0 mb-5">
            <label className="block text-sm font-bold mb-2">
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              value={values.lastName}
              onChange={handleInputChange}
              className="shadow appearance-none rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:shadow-outline bg-slate-700"
              placeholder="Last Name"
            />
          </div>
          <div className="lg:mb-0 mb-5">
            <label className="block text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={values.email}
              onChange={handleInputChange}
              className="shadow appearance-none rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:shadow-outline bg-slate-700"
              placeholder="Email"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold mb-2">
              Image URL
            </label>
            <input
              type="text"
              name="imageURL"
              value={values.imageURL}
              onChange={handleInputChange}
              className="shadow appearance-none rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:shadow-outline bg-slate-700"
              placeholder="Image URL"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Add Employee
          </button>
        </div>
      </form>
    </Layout>
  );
}
