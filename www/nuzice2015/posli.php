<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<meta http-equiv="content-type" content="text/html; charset=windows-1250">
<title>Odes�l�n� emailu</title>
</head>
<body>
<h1>Odes�l�n� emailu</h1>

<?
// ** osetreni vstupnich promennych (c) Alsan.cz ** //
function valid($text) {
	$text = stripslashes($text); // prevede zpet escapovani systemem - /" atd.
	$text = htmlspecialchars($text, ENT_QUOTES); // nahrad� HTML tagy za entity / ENT_QUOTES - prelozi dvojite i jednoduche uvozovky
	$text = trim($text); // odstran� b�l� znaky ze zae�tku a konce oetizce // toto provest az na konci osetrovani !!
	return $text;
}

$predmet = "Prihlaska ".valid($_POST['prijmeni']);
//$email = valid($_POST['prijmeni'])."@".valid($_POST['jmeno'])."cz"; // ???
$email = valid($_POST['mail']);
$spam = valid($_POST['spam']);
$zprava1 = valid($_POST['prijmeni'])." ".valid($_POST['jmeno'])." ".valid($_POST['narozeni'])." ".valid($_POST['vyska'])."cm ".valid($_POST['adresa'])." PS�:".valid($_POST['psc'])." mail: ".valid($_POST['mail']);
$telefony=" tlf1:".valid($_POST['tlf1'])." tlf2:".valid($_POST['tlf2'])." tlf3:".valid($_POST['tlf3'])." tlf4:".valid($_POST['tlf4']);
$stav=" plavec: ".valid($_POST['plav'])." Zdr.stav: ".valid($_POST['S1'])." Pozn: ".valid($_POST['S2']);
$zprava=$zprava1." telefony:".$telefony." ".$stav;

if ($predmet!="" and $email!="" and $zprava!="" and $spam=="2")
{
Mail("kspohoda@volny.cz", $predmet, $zprava, "From: " . $email);
echo "<p><strong>V� e-mail byl �sp�n� odesl�n</strong>.</p>";
}
else
{
echo "<p>V� e-mail se <strong>nepoda�ilo odeslat</strong> pravd�podobn� jste nevyplnili v�echny �daje, nebo nev�te kolik je 1 + 1.</p>";
}
?>
<p align="left"><b><a href="pozvanka.html">Zp�t</a></b></p>

</body>
</html>