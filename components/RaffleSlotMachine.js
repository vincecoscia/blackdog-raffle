import React, { useState, useEffect } from 'react';
import Confetti from 'react-dom-confetti';

const RaffleSlotMachine = ({ employees, onRaffleCompleted }) => {
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [raffleInProgress, setRaffleInProgress] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  const confettiConfig = {  // Configuration for the confetti
    angle: 90,
    spread: 360,
    startVelocity: 30,
    elementCount: 50,
    dragFriction: 0.1,
    duration: 5000,
    stagger: 0,
    width: "10px",
    height: "10px",
    perspective: "500px",
    colors: ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"]
  };

  const startRaffle = () => {
    setRaffleInProgress(true);
  };

  useEffect(() => {
    if (raffleInProgress) {
      const totalEntries = employees.reduce((total, employee) => total + employee.entries, 0);
  
      const weightedRaffle = () => {
        let randomValue = Math.random() * totalEntries;
        for (const employee of employees) {
          randomValue -= employee.entries;
          if (randomValue < 0) {
            return employee;
          }
        }
        return null;
      };
  
      const animationDuration = 5000;
      const intervalDuration = 100;
  
      const raffleAnimation = setInterval(() => {
        setCurrentEmployee(weightedRaffle());
      }, intervalDuration);
  
      setTimeout(() => {
        clearInterval(raffleAnimation);
        const winner = weightedRaffle();
        setCurrentEmployee(winner);
        setRaffleInProgress(false);
        onRaffleCompleted(winner);
      }, animationDuration);
    }

    if (currentEmployee && !raffleInProgress) {
        setConfettiActive(true);
        setTimeout(() => setConfettiActive(false), 5000);  // Deactivate after 5 seconds
    }
  }, [raffleInProgress]);

  return (
    <>
      <div className="flex flex-col items-center p-6 w-72 bg-blue-500 rounded-xl shadow-md">
      <Confetti active={ confettiActive } config={ confettiConfig } />
        <div className="flex items-center justify-center w-full h-16 mb-5 p-1 bg-white rounded shadow-md">
          <span className="text-xl font-semibold text-blue-900">
            {currentEmployee
              ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
              : '---'}
          </span>
        </div>
        <button
          onClick={startRaffle}
          disabled={raffleInProgress}
          className={`px-6 py-2 text-white font-semibold bg-blue-700 rounded shadow-md transition duration-200 ease-in-out hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            raffleInProgress ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Start Raffle
        </button>
      </div>
    </>
  );
};

export default RaffleSlotMachine;
