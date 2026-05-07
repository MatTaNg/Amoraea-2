import React from "react";
import { View, Text } from "react-native";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { DatingProfileEditScreen } from "@/app/screens/DatingProfileEditScreen";
import { styles } from "./ProfileBuilderScreen.styled";

const ProfileBuilderScreen = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <View style={styles.center}>
        <Text>Please sign in</Text>
      </View>
    );
  }

  return (
    <DatingProfileEditScreen
      route={{ params: { userId: user.id } } as { params: { userId: string } }}
      navigation={{ goBack: () => {} }}
    />
  );
};

export default ProfileBuilderScreen;
