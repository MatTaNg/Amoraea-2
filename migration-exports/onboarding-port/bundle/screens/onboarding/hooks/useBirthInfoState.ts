import { useState } from "react";

export interface BirthInfoState {
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  validatedBirthLocation: string;
  birthLocationSuggestions: Array<{ label: string }>;
}

export const useBirthInfoState = () => {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthLocation, setBirthLocation] = useState("");
  const [validatedBirthLocation, setValidatedBirthLocation] = useState<string>("");
  const [birthLocationSuggestions, setBirthLocationSuggestions] = useState<Array<{ label: string }>>([]);

  const state: BirthInfoState = {
    birthDate,
    birthTime,
    birthLocation,
    validatedBirthLocation,
    birthLocationSuggestions,
  };

  return {
    state,
    setters: {
      setBirthDate,
      setBirthTime,
      setBirthLocation,
      setValidatedBirthLocation,
      setBirthLocationSuggestions,
    },
  };
};

