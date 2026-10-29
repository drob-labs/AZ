import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { configured } from '../src/lib/config';
import { useSession } from '../src/state/session';

export default function Index() {
  const { loading, session, employee, demo } = useSession();
  if (configured && loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if ((!session && !demo) || !employee) return <Redirect href="/login" />;
  return <Redirect href={employee.role === 'admin' ? '/team' : '/today'} />;
}
