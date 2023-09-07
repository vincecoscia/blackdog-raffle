import { API_URL } from "../../config/index";
import Layout from "../../components/Layout";
import Image from "next/image";
import { useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import Modal from "../../components/Modal";
import RaffleModal from "../../components/RaffleModal";

export default function EmployeePage(props) {
  const [isOpen, setIsOpen] = useState(false);
  const [raffleIsOpen, setRaffleIsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const employee = props.employee.data;
  const raffles = props.employee.raffles;
  const [values, setValues] = useState({
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    imageURL: employee.imageURL,
    user: employee.user,
  });

  const router = useRouter();

  function closeModal() {
    setIsOpen(false);
  }

  function closeRaffleModal() {
    setRaffleIsOpen(false);
  }

  console.log(employee);
  // handles the input change and sets the value
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch(`${API_URL}/api/employees/${employee._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        toast.error("No token included");
        return;
      }
      toast.error("Something Went Wrong");
    } else {
      const employee = await res.json();
      router.push(`/employee/${props.employee.data._id}`);
    }
  };

  // Delete employees on button click
  async function deleteEmployee() {
    try {
      const res = await fetch(`${API_URL}/api/employees/${employeeData._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message);
      } else {
        setIsOpen(false);
        router.replace(router.asPath);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function deleteRaffle(raffleId) {
    try {
      const res = await fetch(`${API_URL}/api/raffles/${raffleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message);
      } else {
        setIsOpen(false);
        router.replace(router.asPath);
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (!editMode) {
    return (
      <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex">
          {isOpen ? (
            <Modal
              closeModal={closeModal}
              deleteEmployee={deleteEmployee}
              isOpen
              employeeData={employee}
            />
          ) : null}
          {employee.imageURL ? (
            <Image
              src={employee.imageURL}
              alt={employee.firstName}
              width={50}
              height={50}
              layout="fixed"
              style={{ width: "100px", height: "100px" }}
              className="rounded-full object-cover overflow-hidden"
            />
          ) : (
            <Image
              src="/assets/placeholder.jpg"
              alt={employee.firstName}
              width={50}
              height={50}
              layout="fixed"
              style={{ width: "100px", height: "100px" }}
              className="rounded-full object-cover overflow-hidden"
            />
          )}
          <div className="ml-4 justify-center flex flex-col">
            <h3 className="text-2xl font-bold">
              {employee.firstName} {employee.lastName}
            </h3>
            <p className="text-sm">{employee.email}</p>
          </div>
        </div>
        <div className="flex mt-4">
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded-md w-full mr-2"
            onClick={() => setEditMode(!editMode)}
          >
            Edit
          </button>
          <button
            className="bg-red-500 text-white px-3 py-1 rounded-md w-full"
            onClick={() => setIsOpen(true)}
          >
            Delete
          </button>
        </div>
        <div className="mt-10">
          {raffles.length > 0 ? (
            <>
            
          <h3 className="text-2xl font-bold"><span className="underline">Raffles Won:</span> <span className="text-green-500 no-underline">{raffles.length}</span></h3>
          <div className="flex flex-col gap-y-2">
            {raffles.map((raffle) => (
              <>
                <div
                  key={raffle._id}
                  className="w-full hover:bg-slate-700 rounded-md mt-2 px-2 py-2 -mx-2 group flex justify-between items-center"
                >
                  <h4 className="text-xl font-semibold">
                    {new Date(raffle.date).toLocaleDateString("en-us", {
                      weekday: "long",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </h4>
                  <button onClick={() => setRaffleIsOpen(true)}>
                    <Image
                      src="/assets/delete.svg"
                      alt="delete"
                      width={20}
                      height={20}
                      layout="fixed"
                      style={{ width: "20px", height: "20px" }}
                      className="align-top hidden group-hover:block"
                    />
                  </button>
                </div>
                {raffleIsOpen ? (
                  <RaffleModal
                    closeModal={closeRaffleModal}
                    deleteRaffle={deleteRaffle}
                    isOpen={raffleIsOpen}
                    raffleData={raffle}
                    employeeData={employee}
                  />
                ) : null}
              </>
            ))}
          </div>
          </>
          ) : (
            <h3 className="text-2xl font-bold">No Raffles Won</h3>
          )}
        </div>
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
      <button
        className="flex items-center text-slate-500 mb-4"
        onClick={() => setEditMode(!editMode)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4 mr-1"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
          />
        </svg>
        Back
      </button>
      <form onSubmit={handleSubmit}>
        <div className="lg:flex w-full gap-x-2 mb-4">
          <div className="w-full mb-4 lg:mb-0">
            <label htmlFor="firstName">First Name</label>
            <input
              className="w-full px-3 py-2 text-sm text-gray-100 bg-slate-700 border border-gray-800 rounded focus:outline-none focus:border-slate-500"
              type="text"
              name="firstName"
              id="firstName"
              value={values.firstName}
              onChange={handleInputChange}
            />
          </div>
          <div className="w-full">
            <label htmlFor="lastName">Last Name</label>
            <input
              className="w-full px-3 py-2 text-sm text-gray-100 bg-slate-700 border border-gray-800 rounded focus:outline-none focus:border-slate-500"
              type="text"
              name="lastName"
              id="lastName"
              value={values.lastName}
              onChange={handleInputChange}
            />
          </div>
        </div>
        <div className="flex flex-col mb-4">
          <label htmlFor="email">Email</label>
          <input
            className="w-full px-3 py-2 text-sm text-gray-100 bg-slate-700 border border-gray-800 rounded focus:outline-none focus:border-slate-500"
            type="text"
            name="email"
            id="email"
            value={values.email}
            onChange={handleInputChange}
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="imageURL">Image URL</label>
          <input
            className="w-full px-3 py-2 text-sm text-gray-100 bg-slate-700 border border-gray-800 rounded focus:outline-none focus:border-slate-500"
            type="text"
            name="imageURL"
            id="imageURL"
            value={values.imageURL}
            onChange={handleInputChange}
          />
        </div>
        <button
          className="bg-blue-500 text-white px-3 py-1 rounded-md w-full mr-2 mt-4"
          type="submit"
          // onClick={() => setEditMode(!editMode)}
        >
          Save
        </button>
      </form>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ query: { id } }) {
  const res = await fetch(`${API_URL}/api/employees/${id}`);
  const employee = await res.json();

  return {
    props: {
      employee,
    },
  };
}
